// Sonde RTT expérimentale, limitée à une cible à la fois.
// Elle écoute DELIVERY_ACK (3) sur messages.update et conserve une baseline
// par contact. Le PoC de référence associe la réponse à l'ID retourné par
// sendMessage(), et non à l'ID fictif de la cible.
const activeProbes = new Map();
const rttHistory = new Map();
const MAX_HISTORY = 20;
const DELIVERY_ACK = 3;

function randomProbeId() {
    const prefixes = ['3EB0', 'BAE5', 'F1D2', 'A9C4', '7E8B', 'C3F9', '2D6A'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${prefix}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jidBase(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function classifyRTT(jid, rtt) {
    const history = rttHistory.get(jid) || [];
    const baseline = median(history);
    const threshold = baseline == null ? null : Math.round(baseline * 0.9);
    const state = threshold == null
        ? 'Learning'
        : (rtt <= threshold ? 'Online' : 'Standby');

    history.push(rtt);
    if (history.length > MAX_HISTORY) history.shift();
    rttHistory.set(jid, history);

    return {
        state,
        rtt,
        median: baseline == null ? Math.round(rtt) : Math.round(baseline),
        threshold
    };
}

function resolveProbe(probeId, rtt, source = 'receipt') {
    const probe = activeProbes.get(probeId);
    if (!probe) return;
    const result = classifyRTT(probe.jid, rtt);
    probe.finish({ online: true, source, probeMethod: probe.method || null, ...result });
}

function probeContact(sock, jid, timeoutMs = 10000, botState = null) {
    const startedAt = Date.now();
    const normalizedJid = String(jid || '');
    return new Promise((resolve) => {
        let finished = false;
        let fallbackTimer;
        const probeId = `probe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        let activeId = probeId;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            clearTimeout(fallbackTimer);
            activeProbes.delete(activeId);
            sock.ev?.off?.('presence.update', onPresence);
            resolve(result);
        };

        const onPresence = (event = {}) => {
            const presences = event.presences || {};
            const targetBase = jidBase(normalizedJid);
            const entry = presences[normalizedJid]
                || Object.entries(presences).find(([key]) => jidBase(key) === targetBase)?.[1];
            const status = entry?.lastKnownPresence;
            if (!status) return;
            const lastSeen = entry?.lastSeen || null;
            if (botState?.onlineUsers) {
                if (status === 'available' || status === 'composing' || status === 'recording') botState.onlineUsers.set(normalizedJid, Date.now());
                else if (status === 'unavailable') botState.onlineUsers.delete(normalizedJid);
            }
            finish({ online: status !== 'unavailable', status, lastSeen, source: 'presence', rtt: Date.now() - startedAt, state: status === 'available' ? 'Online' : status, median: null, threshold: null });
        };

        const timer = setTimeout(() => finish({ online: false, rtt: null, status: 'timeout', source: 'timeout', state: 'Offline', median: null, threshold: null }), timeoutMs);

        activeProbes.set(probeId, { jid: normalizedJid, startedAt, finish });
        sock.ev?.on?.('presence.update', onPresence);
        Promise.resolve(sock.presenceSubscribe?.(normalizedJid)).catch(() => { });

        const probeEnabled = botState?.ENABLE_LEGACY_RTT_PROBE !== false
            && process.env.ENABLE_LEGACY_RTT_PROBE !== 'false';
        if (probeEnabled) {
            fallbackTimer = setTimeout(() => {
                const sentAt = Date.now();
                const fakeId = randomProbeId();
                const method = botState?.PROBE_METHOD || process.env.PHOENIX_PROBE_METHOD || 'delete';
                const payload = method === 'reaction'
                    ? { react: { text: '👍', key: { remoteJid: normalizedJid, id: fakeId, fromMe: false } } }
                    : { delete: { remoteJid: normalizedJid, id: fakeId, fromMe: true } };
                Promise.resolve(sock.sendMessage?.(normalizedJid, payload))
                    .then((sent) => {
                        const returnedId = sent?.key?.id;
                        if (!returnedId) return;
                        activeProbes.delete(activeId);
                        activeId = returnedId;
                        activeProbes.set(returnedId, {
                            jid: normalizedJid,
                            startedAt: sentAt,
                            finish,
                            method
                        });
                    })
                    .catch(() => { });
            }, 700);
        }
    });
}

function handleMessagesUpdate(updates) {
    for (const item of updates || []) {
        const id = item?.key?.id;
        const status = item?.update?.status;
        if (id && Number(status) === DELIVERY_ACK) {
            const probe = activeProbes.get(id);
            if (probe) resolveProbe(id, Date.now() - probe.startedAt, 'delivery-ack');
        }
    }
}

// Compatibilité avec les versions qui exposent aussi l’accusé via cet event.
function handleDeliveryReceipt(events) {
    for (const receipt of events || []) {
        const id = receipt?.key?.id;
        const status = receipt?.receipt?.status ?? receipt?.status;
        if (id && (status == null || Number(status) === DELIVERY_ACK)) {
            const probe = activeProbes.get(id);
            if (probe) resolveProbe(id, Date.now() - probe.startedAt, 'receipt');
        }
    }
}

function handleRawReceipt(node) {
    const attrs = node?.attrs || {};
    if (!attrs.id || !attrs.from) return;
    if (attrs.type !== 'inactive' && attrs.type !== 'delivery') return;
    const probe = activeProbes.get(attrs.id);
    if (probe) resolveProbe(attrs.id, Date.now() - probe.startedAt, 'raw-receipt');
}

function resetRTTHistory(jid) { if (jid) rttHistory.delete(jid); else rttHistory.clear(); }

async function probeAllContacts(sock, jids, timeoutMs = 10000, botState = null) {
    const results = new Map();
    await Promise.all(jids.map(async (jid) => results.set(jid, await probeContact(sock, jid, timeoutMs, botState))));
    return results;
}

module.exports = { probeContact, probeAllContacts, handleMessagesUpdate, handleDeliveryReceipt, handleRawReceipt, classifyRTT, resetRTTHistory };
