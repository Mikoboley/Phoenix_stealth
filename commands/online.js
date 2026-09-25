const { probeContact } = require('../core/silentTracker');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { isNonPersonJid } = require('../core/contacts');
const { resolveDisplayName } = require('../core/displayNames');

// ==========================================
// ANTI-SPAM : 1 sonde par contact par minute
// ==========================================
const lastProbe = new Map(); // jid → timestamp
const MIN_INTERVAL = 60 * 1000; // 60 secondes

module.exports = {
    name: 'online',
    aliases: ['enligne', 'actifs'],
    description: 'Sonde UN SEUL contact pour voir s\'il est en ligne',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;

        // ==========================================
        // ARGUMENT OBLIGATOIRE
        // ==========================================
        const arg = ctx.args.join(' ').trim();
        if (!arg) {
            await sock.sendMessage(myJid, {
                text: `╭━━━〔 📡 ONLINE 〕━━━╮\n┃ Usage : !online <nom ou numéro>\n┃ Exemple : !online Marie\n┃ ⚠️ Une personne à la fois.\n╰━━━━━━━━━━━━━━━━━━╯`
            });
            return;
        }

        // ==========================================
        // RÉSOLUTION DE LA CIBLE
        // ==========================================
        let targetJid = null;
        let targetName = arg;

        // 1. Numéro direct
        const cleanNum = arg.replace(/\D/g, '');
        if (cleanNum.length >= 7 && cleanNum.length <= 15) {
            targetJid = cleanNum + '@s.whatsapp.net';
        } else {
            // 2. Recherche par nom (partielle)
            const search = arg.toLowerCase();
            for (const [jid, name] of Object.entries(botState.contactNames)) {
                if (isNonPersonJid(jid)) continue;
                if (name.toLowerCase().includes(search)) {
                    targetJid = jid;
                    targetName = name;
                    break;
                }
            }
        }

        if (!targetJid) {
            await sock.sendMessage(myJid, { text: `⚠️ Aucun contact trouvé pour *${arg}*.` });
            return;
        }

        targetJid = jidNormalizedUser(targetJid);
        targetName = (await resolveDisplayName(sock, targetJid, botState, targetName)).name;

        // ==========================================
        // ANTI-SPAM
        // ==========================================
        const now = Date.now();
        const last = lastProbe.get(targetJid);
        if (last && (now - last) < MIN_INTERVAL) {
            const wait = Math.ceil((MIN_INTERVAL - (now - last)) / 1000);
            await sock.sendMessage(myJid, {
                text: `⏱️ Patiente encore *${wait} s* avant de sonder *${targetName}*.\n🛡️ Protection anti-spam active.`
            });
            return;
        }
        lastProbe.set(targetJid, now);

        // ==========================================
        // SONDE
        // ==========================================
        console.log(`📡 [TRACKER] Sonde unique → ${targetName} (${targetJid})`);

        // Les PoC de référence attendent 10 s : un accusé peut arriver après
        // la réponse serveur initiale, surtout avec plusieurs appareils liés.
        const result = await probeContact(sock, targetJid, 10000, botState);

        // ==========================================
        // RÉSULTAT
        // ==========================================
        let state = result.source === 'timeout' ? '⚪ Aucune présence reçue' : '⚫ Hors ligne ou présence masquée';
        let rtt = '—';
        let calibration = '';

        if (result.online) {
            rtt = result.source === 'cache' ? 'présence déjà connue' : `${result.rtt} ms`;
            if (result.source === 'presence') {
                if (result.status === 'available') state = '🟢 En ligne — activité non déterminée';
                else if (result.status === 'composing') state = '🟢 Active — écrit actuellement';
                else if (result.status === 'recording') state = '🟢 Active — enregistre actuellement';
                else if (result.status === 'paused') state = '🟡 A cessé d’écrire';
                else if (result.status === 'unavailable') state = '⚫ Hors ligne ou application en arrière-plan';
                else state = '🟡 Présence reçue : ' + result.status;
            } else if (result.source === 'receipt' || result.source === 'delivery-ack' || result.source === 'raw-receipt') {
                // Un accusé prouve que l’appareil est joignable, pas qu’il est
                // actuellement affiché au premier plan.
                state = '🟡 Joignable — activité non confirmée';
                calibration = `\n📊 Médiane : ${result.median} ms` +
                    (result.threshold == null ? '' : `\n📏 Seuil adaptatif : ${result.threshold} ms`);
            }
            else if (result.source === 'cache') state = '🟡 Présence connue récemment';
        }

        await sock.sendMessage(myJid, {
            text: `╭━━━〔 📡 PHOENIX PULSE 〕━━━╮\n` +
                  `┃ 👤 Contact : *${targetName}*\n` +
                  `┃ 📱 État : ${state}\n` +
                  `┃ ⏱️ Réponse : ${rtt}${calibration}\n` +
                  `┣━━━━━━━━━━━━━━━━━━━━━━┫\n` +
                  `┃ 💡 Active = écrit/enregistre ; en ligne ≠ premier plan\n` +
                  `┃ 🟡 Joignable = accusé réseau, pas activité confirmée\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯`
        });
    }
};
