const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { registerMapping, resolveLidToPhone } = require('./lidResolver');
const { setContactName, getAllContacts } = require('./contacts');

function clean(value) {
    const text = String(value || '').trim();
    if (!text || text === '.' || /^\d+$/.test(text)) return '';
    if (/^contact\s+(?:\d+|whatsapp)$/i.test(text)) return '';
    if ((text.match(/\d/g) || []).length >= 4 && /^[+\d\s().∙•·–—-]+$/.test(text)) return '';
    return text;
}

function numberOf(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function phoneJid(number) {
    return `${String(number || '').replace(/\D/g, '')}@s.whatsapp.net`;
}

function getStoredName(jid, botState) {
    const normalized = jidNormalizedUser(jid || '');
    const names = botState?.contactNames || {};
    const direct = clean(names[normalized]) || clean(names[jid]);
    if (direct) return direct;
    const number = numberOf(normalized);
    if (number) {
        const canonical = clean(names[phoneJid(number)]);
        if (canonical) return canonical;
    }
    if (number) {
        const contact = getAllContacts().find((entry) => numberOf(entry.jid) === number);
        if (contact) return clean(contact.name);
    }
    return '';
}

function saveResolvedName(jid, name, botState) {
    const cleanName = clean(name);
    if (!cleanName || !botState) return false;
    const normalized = jidNormalizedUser(jid);
    const number = numberOf(normalized);
    const keys = [normalized];
    if (number) keys.push(phoneJid(number));
    let changed = false;
    for (const key of keys) {
        if (botState.contactNames[key] !== cleanName) {
            botState.contactNames[key] = cleanName;
            setContactName(key, cleanName);
            changed = true;
        }
    }
    if (changed && typeof botState.scheduleSaveContacts === 'function') botState.scheduleSaveContacts();
    return changed;
}

function contactNameFromObject(contact) {
    // Baileys: `name` = nom du carnet. `notify` est un nom de profil et ne
    // doit jamais être persisté comme nom du carnet.
    return clean(contact?.name);
}

function rememberContact(contact, botState) {
    if (!contact?.id || !botState) return '';
    const jid = jidNormalizedUser(contact.id);
    const name = contactNameFromObject(contact);
    if (!name) return '';
    if (jid.endsWith('@lid') && contact?.phoneNumber) {
        registerMapping(jid, contact.phoneNumber);
        saveResolvedName(phoneJid(numberOf(contact.phoneNumber)), name, botState);
    }
    saveResolvedName(jid, name, botState);
    return name;
}

async function resolveDisplayName(sock, jid, botState, fallback = '') {
    if (!jid) return { name: clean(fallback) || 'Contact WhatsApp', number: '' };
    const normalized = jidNormalizedUser(jid);
    let name = getStoredName(normalized, botState);
    if (name) return { name, number: numberOf(normalized) };

    let phone = numberOf(normalized);
    if (normalized.endsWith('@lid')) {
        phone = await resolveLidToPhone(sock, normalized) || phone;
        if (phone) {
            const realJid = phoneJid(phone);
            name = getStoredName(realJid, botState);
            if (name) return { name, number: phone };
        }
    }

    // Certains builds de Baileys exposent le carnet sur sock.contacts.
    const contacts = sock?.contacts;
    if (contacts && typeof contacts === 'object') {
        const candidates = [normalized, phoneJid(phone)];
        for (const key of candidates) {
            const contact = contacts[key];
            const contactName = contactNameFromObject(contact);
            if (contactName) {
                saveResolvedName(key, contactName, botState);
                return { name: contactName, number: phone || numberOf(key) };
            }
        }
    }

    const profileFallback = clean(fallback) || clean(botState?.profileNames?.[normalized]) || clean(botState?.profileNames?.[phoneJid(phone)]);
    return { name: profileFallback || 'Contact WhatsApp', number: phone };
}

function getDisplayNameSync(jid, botState, fallback = '') {
    const name = getStoredName(jid, botState);
    return name || clean(fallback) || 'Contact WhatsApp';
}

module.exports = {
    clean,
    numberOf,
    phoneJid,
    getStoredName,
    saveResolvedName,
    rememberContact,
    resolveDisplayName,
    getDisplayNameSync
};
