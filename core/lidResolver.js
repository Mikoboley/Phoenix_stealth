const lidToPhoneCache = new Map();
const phoneToLidCache = new Map();

function cleanPart(value) {
    return String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function registerMapping(lid, phone) {
    const lidNum = cleanPart(lid);
    const phoneNum = cleanPart(phone);
    if (!lidNum || !phoneNum) return;
    lidToPhoneCache.set(lidNum, phoneNum);
    phoneToLidCache.set(phoneNum, lidNum);
    globalThis.lidPhoneCache?.set(lidNum, phoneNum);
}

async function resolveViaBaileys(sock, lid) {
    try {
        const mapping = sock?.signalRepository?.lidMapping;
        if (typeof mapping?.getPNForLID !== 'function') return null;
        const lidNum = cleanPart(lid);
        const candidates = [`${lidNum}@lid`, lidNum];
        for (const candidate of candidates) {
            const value = await mapping.getPNForLID(candidate);
            const phoneNum = cleanPart(value);
            if (phoneNum) {
                registerMapping(lidNum, phoneNum);
                return phoneNum;
            }
        }
    } catch (_) { }
    return null;
}

function resolveViaCache(lid) {
    const lidNum = cleanPart(lid);
    return globalThis.lidPhoneCache?.get(lidNum) || lidToPhoneCache.get(lidNum) || null;
}

async function resolveViaOnWhatsApp(sock, lid) {
    try {
        if (typeof sock?.onWhatsApp !== 'function') return null;
        const result = await sock.onWhatsApp(lid);
        const phoneNum = cleanPart(result?.[0]?.jid);
        if (phoneNum) {
            registerMapping(lid, phoneNum);
            return phoneNum;
        }
    } catch (_) { }
    return null;
}

async function resolveLidToPhone(sock, lid) {
    if (!lid) return null;
    const cached = resolveViaCache(lid);
    if (cached) return cached;
    return await resolveViaBaileys(sock, lid) || await resolveViaOnWhatsApp(sock, lid);
}

module.exports = {
    resolveLidToPhone,
    registerMapping,
    lidToPhoneCache,
    phoneToLidCache
};
