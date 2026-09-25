const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const { handleMessages, handleReceipts } = require('./core/messages');
const { handleDeliveryReceipt, handleMessagesUpdate, handleRawReceipt } = require('./core/silentTracker');
const { incrementMessagesSent } = require('./core/stats');
const { setContactName, isNonPersonJid } = require('./core/contacts');
const { rememberContact } = require('./core/displayNames');
const { registerMapping } = require('./core/lidResolver');
const onlineAlerts = require('./core/onlineAlerts');

// ==========================================
// ANTI-CRASH
// ==========================================
process.on('uncaughtException', (err) => {
    console.error(`🔥 [ANTI-CRASH] uncaughtException:`, err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error(`🔥 [ANTI-CRASH] unhandledRejection:`, reason);
});

// ==========================================
// FILTRE DE LOGS
// ==========================================
const FILTER_PATTERNS = [
    'Closing session:', 'Closing open session', 'currentRatchet',
    'SessionEntry', '_chains:', 'ephemeralKeyPair:',
    'lastRemoteEphemeralKey:', 'previousCounter:', 'rootKey:',
    'indexInfo:', 'baseKey:', 'baseKeyType:', 'remoteIdentityKey:',
    'pendingPreKey:', 'registrationId:', 'chainKey:', 'chainType:',
    'messageKeys:', 'signedKeyId:', 'preKeyId:', 'pubKey:', 'privKey:'
];

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const QUIET_TERMINAL = process.env.PHOENIX_VERBOSE !== 'true';

function shouldFilter(chunk) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    return FILTER_PATTERNS.some(p => str.includes(p));
}

process.stdout.write = (chunk, ...args) => {
    if (shouldFilter(chunk)) return true;
    return originalStdoutWrite(chunk, ...args);
};

process.stderr.write = (chunk, ...args) => {
    if (shouldFilter(chunk)) return true;
    return originalStderrWrite(chunk, ...args);
};

if (QUIET_TERMINAL) {
    console.log = () => {};
    console.warn = () => {};
}

function terminalNotice(text) {
    originalStdoutWrite(`${text}\n`);
}

// ==========================================
// SERVEUR
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Noyau Phoenix Actif.'));
app.listen(process.env.PORT || 3000, () => console.log(`🌐 Serveur Web actif.`));

// ==========================================
// ÉTAT GLOBAL
// ==========================================
const LOCAL_DIR = path.join(__dirname, 'Phoenix_Media');
const NAMES_FILE = path.join(LOCAL_DIR, 'contacts_names.json');
const STATUS_JSON = path.join(LOCAL_DIR, 'status_cache.json');
const ONLINE_ALERTS_JSON = path.join(LOCAL_DIR, 'online_alerts.json');
const STATUS_DIR = path.join(LOCAL_DIR, 'statuses');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
if (!fs.existsSync(STATUS_DIR)) fs.mkdirSync(STATUS_DIR, { recursive: true });

let cleanContacts = {};
if (fs.existsSync(NAMES_FILE)) {
    try {
        const rawContacts = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
        for (const [key, name] of Object.entries(rawContacts)) {
            const jid = jidNormalizedUser(key);
            if (!isNonPersonJid(jid) && !jid.endsWith('@lid')) cleanContacts[jid] = name;
        }
        console.log(`📇 ${Object.keys(cleanContacts).length} contact(s) chargé(s)`);
    } catch (e) { }
}

const botState = {
    PHONE_NUMBER: String(process.env.PHONE_NUMBER || '').replace(/\D/g, ''),
    START_TIME: Date.now(),
    LOCAL_DIR: LOCAL_DIR,
    NAMES_FILE: NAMES_FILE,
    STATUS_JSON: STATUS_JSON,
    ONLINE_ALERTS_JSON,
    DIRS: { statuts: STATUS_DIR },
    cacheMessages: new Map(),
    contactNames: cleanContacts,
    // Noms de profil temporaires : utilisés seulement quand aucun nom du
    // carnet WhatsApp n’existe, jamais à la place d’un nom enregistré.
    profileNames: {},
    scheduleSaveContacts,
    activeIntervals: {},
    statusCache: loadJsonFile(STATUS_JSON, {}),
    onlineAlerts: onlineAlerts.load(ONLINE_ALERTS_JSON),
    isSavingContacts: false,
    isSavingStatus: false,
    currentSock: null,
    onlineUsers: new Map(),
    subscribedJids: new Set(),
    loginMode: null
};

global.botState = botState;
if (!globalThis.lidPhoneCache) globalThis.lidPhoneCache = new Map();

// ==========================================
// FLAGS PERSISTANTS
// ==========================================
let PROCESS_PAIRING_REQUESTED = false;
let PROCESS_HAS_CONNECTED = false;

function loadJsonFile(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
        console.warn(`⚠️ Impossible de lire ${file}: ${e.message}`);
        return fallback;
    }
}

function saveContactsNow() {
    try {
        fs.writeFileSync(botState.NAMES_FILE, JSON.stringify(botState.contactNames, null, 2));
    } catch (e) { }
}

let saveContactsTimer = null;
function scheduleSaveContacts() {
    if (saveContactsTimer) clearTimeout(saveContactsTimer);
    saveContactsTimer = setTimeout(saveContactsNow, 3000);
}

function getWhatsAppContactName(contact) {
    const savedName = String(contact?.name || '').trim();
    if (savedName && savedName !== '.') return savedName;
    return '';
}

function syncWhatsAppContacts(contacts, sock) {
    let changed = 0;
    for (const contact of contacts || []) {
        if (!contact?.id) continue;
        const jid = jidNormalizedUser(contact.id);
        if (isNonPersonJid(jid)) continue;
        const name = rememberContact(contact, botState) || getWhatsAppContactName(contact);
        // Les LID servent à résoudre les appareils, mais ne doivent jamais
        // apparaître comme des contacts séparés dans le carnet.
        if (isNonPersonJid(jid) || jid.endsWith('@lid')) continue;
        if (name && !jid.endsWith('@g.us')) {
            // `name` est le nom enregistré dans le carnet WhatsApp.
            // `notify` est seulement le nom de profil et sert de repli.
            if (name && botState.contactNames[jid] !== name) {
                botState.contactNames[jid] = name;
                setContactName(jid, name);
                changed++;
            }
        }
        if (sock && !jid.endsWith('@g.us')) enqueueSubscribe(sock, jid);
    }
    if (changed > 0) scheduleSaveContacts();
    return changed;
}

// ==========================================
// QUEUE DE SUBSCRIPTION
// ==========================================
const subscriptionQueue = [];
let isProcessingQueue = false;
let lastSubscribeTime = 0;
const MIN_SUBSCRIBE_INTERVAL = 200;

function enqueueSubscribe(sock, jid) {
    if (!jid) return;
    if (botState.subscribedJids.has(jid)) return;
    if (subscriptionQueue.includes(jid)) return;
    subscriptionQueue.push(jid);
    botState.subscribedJids.add(jid);
    if (!isProcessingQueue) processSubscriptionQueue(sock);
}

async function processSubscriptionQueue(sock) {
    isProcessingQueue = true;
    while (subscriptionQueue.length > 0) {
        const jid = subscriptionQueue.shift();
        const now = Date.now();
        const wait = MIN_SUBSCRIBE_INTERVAL - (now - lastSubscribeTime);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        try {
            await sock.presenceSubscribe(jid);
            lastSubscribeTime = Date.now();
        } catch (e) { }
    }
    isProcessingQueue = false;
}

// ==========================================
// NETTOYAGE PÉRIODIQUE
// ==========================================
setInterval(() => {
    const now = Date.now();
    for (const jid in botState.statusCache) {
        // Les statuts sont horodatés par Date.now(), donc l'expiration est en ms.
        botState.statusCache[jid] = botState.statusCache[jid].filter(s => {
            const rawTimestamp = Number(s.timestamp || 0);
            const timestampMs = rawTimestamp > 0 && rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
            return timestampMs > 0 && (now - timestampMs) < 86400 * 1000;
        });
        if (botState.statusCache[jid].length === 0) delete botState.statusCache[jid];
    }
    if (botState.cacheMessages.size > 3000) {
        const firstKey = botState.cacheMessages.keys().next().value;
        botState.cacheMessages.delete(firstKey);
    }
    const nowMs = Date.now();
    for (const [jid, ts] of botState.onlineUsers.entries()) {
        if (nowMs - ts > 120000) botState.onlineUsers.delete(jid);
    }
}, 3600000);

// ==========================================
// CHOIX MODE
// ==========================================
function askLoginMode() {
    const AUTH_DIR = path.resolve(process.env.AUTH_DIR || path.join(__dirname, 'auth_info'));
    return fs.existsSync(path.join(AUTH_DIR, 'creds.json')) ? 'existing' : 'pairing';
}

// ==========================================
// MOTEUR
// ==========================================
let reconnectTimer = null;
let pairingTimer = null;
let attemptCount = 0;
const MAX_ATTEMPTS = 3;

async function startStealthBot() {
    try {
        attemptCount++;
        console.log(`\n📡 [SYSTEM] Initialisation du Noyau Phoenix Stealth (Tentative #${attemptCount})...`);

        const AUTH_DIR = path.resolve(process.env.AUTH_DIR || path.join(__dirname, 'auth_info'));
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            markOnlineOnConnect: false,
            syncFullHistory: true,
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            getMessage: async (key) => botState.cacheMessages.get(key.id)?.message || undefined
        });

        const sendMessage = sock.sendMessage.bind(sock);
        sock.sendMessage = async (...args) => {
            const result = await sendMessage(...args);
            incrementMessagesSent();
            return result;
        };

        botState.currentSock = sock;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // ==========================================
            // PAIRING CODE
            // ==========================================
            if (
                qr &&
                botState.loginMode === 'pairing' &&
                !state.creds.registered &&
                !PROCESS_PAIRING_REQUESTED &&
                !PROCESS_HAS_CONNECTED
            ) {
                PROCESS_PAIRING_REQUESTED = true;

                console.log('\n🔢 Mode pairing — connexion prête, attente de 5 secondes...');
                pairingTimer = setTimeout(async () => {
                    pairingTimer = null;
                    try {
                        const phone = String(botState.PHONE_NUMBER).replace(/\D/g, '');
                        if (!/^\d{7,15}$/.test(phone)) {
                            throw new Error('PHONE_NUMBER doit contenir 7 à 15 chiffres avec indicatif pays');
                        }
                        const code = await sock.requestPairingCode(phone);

                        terminalNotice(`🔢 CODE DE JUMELAGE : ${code?.match(/.{1,4}/g)?.join('-') || 'indisponible'}\nWhatsApp → Appareils connectés → Associer un appareil → Avec un numéro de téléphone`);
                    } catch (err) {
                        console.error('❌ Erreur pairing:', err.message);
                        PROCESS_PAIRING_REQUESTED = false;
                    }
                }, 5000);
            }

            // ==========================================
            // FERMETURE
            // ==========================================
            if (connection === 'close') {
                if (pairingTimer) {
                    clearTimeout(pairingTimer);
                    pairingTimer = null;
                }
                for (const jid in botState.activeIntervals) clearInterval(botState.activeIntervals[jid]);
                botState.activeIntervals = {};
                if (botState.currentSock === sock) botState.currentSock = null;

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isRegistered = state.creds.registered === true;
                const pairingFailedBeforeRegistration = !isRegistered && botState.loginMode === 'pairing';
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut || pairingFailedBeforeRegistration;
                if (!isRegistered) PROCESS_PAIRING_REQUESTED = false;


                // ==========================================
                // NETTOYAGE UNIQUEMENT sur 401 / 408
                // ==========================================
                if ((statusCode === 401 || statusCode === 408) && isRegistered) {
                    try {
                        if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    } catch (e) { }
                    PROCESS_PAIRING_REQUESTED = false;
                    PROCESS_HAS_CONNECTED = false;
                    botState.loginMode = null;
                }

                // ==========================================
                // DELAY
                // ==========================================
                let delay = 3000;
                if (statusCode === 440) delay = 15000;
                if (statusCode === 405 && attemptCount >= MAX_ATTEMPTS) {
                    delay = 30000;
                    attemptCount = 0;
                }
                if (statusCode === 503) delay = 5000;
                if (statusCode === 428 && !isRegistered) {
                    delay = 3000;
                }

                if (shouldReconnect && !reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        if (!botState.loginMode) {
                            askLoginMode().then((mode) => {
                                botState.loginMode = mode;
                                startStealthBot();
                            });
                        } else {
                            startStealthBot();
                        }
                    }, delay);
                }
            } else if (connection === 'open') {
                PROCESS_HAS_CONNECTED = true;
                PROCESS_PAIRING_REQUESTED = true;
                attemptCount = 0;
                const connectedId = sock.user?.id || sock.user?.jid || '';
                const connectedNumber = String(connectedId).split('@')[0].split(':')[0].replace(/\D/g, '');
                if (/^\d{7,15}$/.test(connectedNumber)) {
                    botState.PHONE_NUMBER = connectedNumber;
                }
                try { await sock.sendPresenceUpdate('unavailable'); } catch (e) { }
            }
        });

        sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
            try {
                const added = syncWhatsAppContacts(contacts, sock);
                if (added > 0) console.log(`📚 [HISTORY] +${added} contact(s) (total : ${Object.keys(botState.contactNames).length})`);
                if (isLatest) console.log(`✅ [HISTORY] Sync complète`);
            } catch (e) { }
        });

        sock.ev.on('lid-mapping.update', (map) => {
            try {
                let newOnes = 0;
                for (const [lid, pn] of Object.entries(map || {})) {
                    const lidNum = String(lid).split('@')[0].split(':')[0];
                    const phone = String(pn).split('@')[0].split(':')[0].replace(/\D/g, '');
                    if (lidNum && phone && !globalThis.lidPhoneCache.has(lidNum)) {
                        registerMapping(lidNum, phone);
                        newOnes++;
                    }
                }
                if (newOnes > 0) console.log(`📇 [LID] +${newOnes} (total : ${globalThis.lidPhoneCache.size})`);
            } catch (e) { }
        });

        sock.ev.on('contacts.upsert', async (contacts) => {
            const newNames = syncWhatsAppContacts(contacts, sock);
            if (newNames > 0) {
                console.log(`📇 [CONTACTS] +${newNames}`);
            }
        });

        sock.ev.on('contacts.update', (contacts) => {
            const updated = syncWhatsAppContacts(contacts, sock);
            if (updated > 0) console.log(`📇 [CONTACTS] ${updated} nom(s) synchronisé(s)`);
        });

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                const jid = msg.key?.remoteJid;

                if (jid && !jid.endsWith('@g.us') && jid !== 'status@broadcast') {
                    enqueueSubscribe(sock, jid);
                }
            }
        });

        sock.ev.on('presence.update', async ({ id, presences }) => {
            for (const jid in (presences || {})) {
                const status = presences[jid].lastKnownPresence;
                if (status === 'available' || status === 'composing' || status === 'recording') {
                    const wasOffline = !botState.onlineUsers.has(jid);
                    botState.onlineUsers.set(jid, Date.now());
                    if (wasOffline) {
                        const display = await require('./core/displayNames').resolveDisplayName(sock, jid, botState);
                        console.log(`🟢 ${display.name} est en ligne`);
                    }
                    try {
                        const profileName = botState.profileNames?.[jidNormalizedUser(jid)] || '';
                        await onlineAlerts.notify(sock, botState, jid, status, profileName);
                    } catch (e) { console.error('⚠️ [ALERTE ONLINE]', e.message); }
                } else if (status === 'unavailable') {
                    botState.onlineUsers.delete(jid);
                    onlineAlerts.markOffline(botState, jid);
                }
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;
                await handleMessages(sock, m, botState);
            } catch (e) {
                console.error('⚠️ [MESSAGES] Erreur:', e.message);
            }
        });

        // Selon la version de WhatsApp/Baileys, une révocation peut arriver
        // comme messages.upsert ou comme messages.update.
        sock.ev.on('messages.update', async (updates) => {
            try { handleMessagesUpdate(updates); } catch (e) { }
            for (const item of updates || []) {
                const protocol = item?.update?.message?.protocolMessage;
                if (!protocol || (protocol.type !== 0 && protocol.type !== 'REVOKE')) continue;
                console.log(`🗑️ [ANTI-DELETE] Révocation reçue via messages.update : ${protocol.key?.id || '?'}`);
                try {
                    await handleMessages(sock, {
                        type: 'notify',
                        messages: [{
                            key: item.key,
                            message: item.update.message,
                            messageTimestamp: item.update.messageTimestamp
                        }]
                    }, botState);
                } catch (e) {
                    console.error('⚠️ [ANTI-DELETE] Erreur messages.update:', e.message);
                }
            }
        });

        sock.ev.on('message-receipt.update', (events) => {
            try {
                handleDeliveryReceipt(events);
                if (handleReceipts) handleReceipts(events, botState);
            } catch (e) { }
        });

        // Certaines versions transmettent les reçus "inactive" uniquement
        // sur le flux brut du WebSocket, que Baileys ne remonte pas toujours.
        if (sock.ws?.on) {
            sock.ws.on('CB:receipt', (node) => {
                try { handleRawReceipt(node); } catch (e) { }
            });
        }

    } catch (err) {
        console.error('🔥 Erreur startStealthBot:', err);
        if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; startStealthBot(); }, 5000);
    }
}

async function main() {
    if (!/^\d{7,15}$/.test(botState.PHONE_NUMBER)) {
        terminalNotice('⚠️ Configure PHONE_NUMBER dans l’environnement avant le premier démarrage.');
        process.exit(1);
    }
    botState.loginMode = askLoginMode();
    startStealthBot().catch((err) => console.error('🔥 Erreur fatale:', err));
}

main().catch((err) => {
    console.error('🔥 Démarrage impossible:', err);
    process.exitCode = 1;
});
