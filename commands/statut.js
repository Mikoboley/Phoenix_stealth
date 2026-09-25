const fs = require('fs');
const { normalizeMessageContent } = require('@whiskeysockets/baileys');
const { resolveDisplayName } = require('../core/displayNames');

function getRealMessage(message) {
    if (!message) return null;
    let normalized = normalizeMessageContent(message);
    if (!normalized) return null;
    while (normalized.ephemeralMessage || normalized.documentWithCaptionMessage) {
        normalized = normalized.ephemeralMessage?.message || normalized.documentWithCaptionMessage?.message;
        if (!normalized) return null;
    }
    return normalized;
}

function buildCaption(header, caption) {
    const clean = (caption || '').trim();
    return clean ? `${header}\n\n📝 *Légende :*\n${clean}` : header;
}

function ownerJid(botState) {
    return `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
}

function statusLabel(item, index) {
    const kind = item.type === 'text' ? '📝' : item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : item.type === 'audio' ? '🎧' : '📎';
    const preview = String(item.text || item.caption || '').replace(/\s+/g, ' ').trim();
    return `${index}. ${kind} ${preview ? preview.slice(0, 70) : 'statut média'}${item.seen ? ' · déjà vu' : ' · non lu'}`;
}

function selectByPythonIndex(items, index) {
    if (!Number.isInteger(index) || index === 0) return null;
    const position = index > 0 ? index - 1 : items.length + index;
    return position >= 0 && position < items.length ? items[position] : null;
}

module.exports = {
    name: 'statut',
    aliases: ['status'],
    description: 'Statuts non lus',
    async execute(sock, msg, botState, ctx) {
        const myJid = ownerJid(botState);
        const rawArgs = [...ctx.args];
        const mode = (rawArgs[0] || '').toLowerCase();
        const downloadMode = mode === 'download' || mode === 'dl' || mode === 'telecharger' || mode === 'save';
        if (downloadMode) rawArgs.shift();
        let selectionIndex = null;
        if (downloadMode && /^-?\d+$/.test(rawArgs.at(-1) || '')) selectionIndex = Number(rawArgs.pop());
        const query = rawArgs.join(' ').trim().toLowerCase();
        const entries = Object.entries(botState.statusCache || {});
        const unseenAuthors = entries.filter(([, statuses]) => statuses.some((status) => !status.seen));
        let targetJid = null;
        let targetName = null;
        let statuses = null;

        if (!query && downloadMode && selectionIndex !== null) {
            const available = [];
            for (const [jid, list] of entries) {
                const display = await resolveDisplayName(sock, jid, botState, list[0]?.senderName);
                for (const item of list) available.push({ jid, item, name: display.name });
            }
            const chosen = selectByPythonIndex(available, selectionIndex);
            if (!chosen) {
                await sock.sendMessage(myJid, { text: `⚠️ Index *${selectionIndex}* invalide. Utilise un numéro entre 1 et ${available.length}, ou -1 pour le dernier.` });
                return;
            }
            targetJid = chosen.jid;
            statuses = [chosen.item];
            targetName = chosen.name;
        }
        if (!query && downloadMode && selectionIndex === null) {
            const available = [];
            for (const [jid, list] of entries) {
                const display = await resolveDisplayName(sock, jid, botState, list[0]?.senderName);
                for (const item of list) available.push({ item, name: display.name });
            }
            if (!available.length) {
                await sock.sendMessage(myJid, { text: '📭 Aucun statut disponible dans le cache.' });
                return;
            }
            const text = `╭━━━〔 ⬇️ STATUTS DISPONIBLES 〕━━━╮\n┃ ${available.length} élément(s)\n┣━━━━━━━━━━━━━━━━━━━━━━━━╯\n${available.map((entry, i) => `┃ ${statusLabel(entry.item, i + 1)}\n┃ 👤 ${entry.name}`).join('\n')}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n💡 Télécharger : !statut download <nom> <numéro>\n💡 Le dernier : !statut download <nom> -1`;
            await sock.sendMessage(myJid, { text });
            return;
        }
        if (!query && !(downloadMode && selectionIndex !== null)) {
            if (!unseenAuthors.length) {
                await sock.sendMessage(myJid, { text: '╭━━━〔 👁️ STATUTS 〕━━━╮\n┃ 📭 Aucun statut non lu\n┃ 🌿 Tout est à jour.\n╰━━━━━━━━━━━━━━━━━━╯' });
                return;
            }
            let text = `╭━━━〔 👁️ STATUTS NON LUS 〕━━━╮\n┃ 👥 ${unseenAuthors.length} contact(s)\n┣━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
            for (const [jid, statuses] of unseenAuthors) {
                const count = statuses.filter((status) => !status.seen).length;
                const display = await resolveDisplayName(sock, jid, botState, statuses[0]?.senderName);
                text += `┃ 👤 *${display.name}* — ${count} statut(s)\n`;
            }
            text += '\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n💡 Tape `!statut <nom>` pour ouvrir un contact.';
            await sock.sendMessage(myJid, { text });
            return;
        }

        for (const [jid, list] of entries) {
            if (targetJid) break;
            const display = await resolveDisplayName(sock, jid, botState, list[0]?.senderName);
            const number = jid.split('@')[0].toLowerCase();
            const name = display.name.toLowerCase();
            if (number.includes(query) || name.includes(query)) {
                targetJid = jid;
                statuses = list;
                targetName = display.name;
                break;
            }
        }

        if (!targetJid) {
            await sock.sendMessage(myJid, { text: `⚠️ Aucun statut trouvé pour *${query}*.` });
            return;
        }

        const unseen = statuses.filter((status) => !status.seen);
        let itemsToShow = downloadMode ? statuses : unseen;
        if (downloadMode && selectionIndex !== null && !(!query && targetJid)) {
            const chosen = selectByPythonIndex(statuses, selectionIndex);
            if (!chosen) {
                await sock.sendMessage(myJid, { text: `⚠️ Index *${selectionIndex}* invalide pour *${targetName}*. Utilise un numéro entre 1 et ${statuses.length}, ou -1 pour le dernier.` });
                return;
            }
            itemsToShow = [chosen];
        }
        if (downloadMode && selectionIndex === null) {
            const listText = statuses.map((item, i) => statusLabel(item, i + 1)).join('\n');
            await sock.sendMessage(myJid, { text: `╭━━━〔 ⬇️ STATUTS DE ${targetName.toUpperCase()} 〕━━━╮\n┃ ${statuses.length} élément(s) disponible(s)\n┣━━━━━━━━━━━━━━━━━━━━━━━━╯\n${listText}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n💡 Télécharger le dernier : !statut download ${targetName} -1` });
            return;
        }
        if (!itemsToShow.length) {
            await sock.sendMessage(myJid, { text: `🕵️ Aucun statut non lu pour *${targetName}*.` });
            return;
        }

        const heading = downloadMode ? '⬇️ TÉLÉCHARGEMENT DES STATUTS' : `👁️ STATUTS DE ${targetName.toUpperCase()}`;
        await sock.sendMessage(myJid, { text: `╭━━━〔 ${heading} 〕━━━╮\n┃ 📦 ${itemsToShow.length} élément(s) à afficher\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯` });
        for (const item of itemsToShow) {
            try {
                const content = item.msg ? getRealMessage(item.msg.message) : null;
                const type = item.type
                    || (content?.imageMessage ? 'image'
                    : content?.videoMessage ? 'video'
                    : content?.audioMessage ? 'audio' : 'text');

                if (type === 'text') {
                    const text = item.text || content?.conversation || content?.extendedTextMessage?.text || '';
                    await sock.sendMessage(myJid, { text: `📝 *Statut de ${targetName}*\n\n${text}` });
                } else if (item.localPath && fs.existsSync(item.localPath)) {
                    const buffer = fs.readFileSync(item.localPath);
                    const caption = buildCaption(`🦅 *Statut de ${targetName}*`, item.caption);
                    if (type === 'image') {
                        await sock.sendMessage(myJid, { image: buffer, caption });
                    } else if (type === 'video') {
                        await sock.sendMessage(myJid, { video: buffer, caption });
                    } else if (type === 'audio') {
                        await sock.sendMessage(myJid, { text: caption });
                        await sock.sendMessage(myJid, {
                            audio: buffer,
                            mimetype: item.mimetype || 'audio/ogg; codecs=opus',
                            ptt: Boolean(item.ptt)
                        });
                    }
                } else {
                    await sock.sendMessage(myJid, { text: `⚠️ Le statut de *${targetName}* n’est plus disponible localement.` });
                }
            } finally {
                item.seen = true;
            }
        }

        if (botState.STATUS_JSON) {
            try {
                fs.writeFileSync(botState.STATUS_JSON, JSON.stringify(botState.statusCache, null, 2));
            } catch (error) {
                console.error('⚠️ Impossible de sauvegarder les statuts:', error.message);
            }
        }
        await sock.sendMessage(myJid, { text: downloadMode
            ? `✅ Les statuts disponibles de *${targetName}* ont été téléchargés.`
            : `✅ Les statuts de *${targetName}* ont été traités.` });
    }
};
