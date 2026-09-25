function getReplyTarget(msg, ctx) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.imageMessage?.contextInfo
        || msg.message?.videoMessage?.contextInfo
        || msg.message?.documentMessage?.contextInfo;
    if (!contextInfo?.stanzaId) return msg.key;
    return {
        remoteJid: ctx.from,
        id: contextInfo.stanzaId,
        participant: ctx.isGroup ? contextInfo.participant : undefined,
        fromMe: false
    };
}

module.exports = {
    name: 'tagall',
    aliases: ['tous', 'everyone', 'all'],
    description: 'Mentionne tous les membres du groupe',
    async execute(sock, msg, botState, ctx) {
        console.log('📢 [TAGALL] Commande reçue | isGroup:', ctx.isGroup, '| from:', ctx.from);
        const replyTarget = getReplyTarget(msg, ctx);
        if (!ctx.isGroup) {
            await sock.sendMessage(ctx.from, { text: '👥 Cette commande est disponible uniquement dans un groupe.' }, { quoted: replyTarget });
            return;
        }

        const customMessage = ctx.args.join(' ').trim();
        try {
            const groupMetadata = await sock.groupMetadata(ctx.from);
            const participants = groupMetadata?.participants || [];
            if (participants.length === 0) {
                await sock.sendMessage(ctx.from, { text: '📭 Aucun membre trouvé dans ce groupe.' }, { quoted: replyTarget });
                return;
            }

            const mentions = [...new Map(participants
                .map(p => p.id || p.jid || p.lid)
                .filter(jid => jid && (jid.includes('@s.whatsapp.net') || jid.includes('@lid') || jid.includes('@c.us')))
                .map(jid => [jid, jid])).values()];
            if (mentions.length === 0) {
                await sock.sendMessage(ctx.from, { text: '⚠️ Aucun membre mentionnable dans ce groupe.' }, { quoted: replyTarget });
                return;
            }

            const subject = String(groupMetadata.subject || 'ce groupe').trim();
            let text = `📢 *${customMessage || 'Notification générale'}*\n\n`;
            text += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');
            await sock.sendMessage(ctx.from, { text: `👥 *${subject}*\n\n${text.trim()}`, mentions }, { quoted: replyTarget });
            console.log(`✅ [TAGALL] ${subject} : ${mentions.length} membres mentionnés`);
        } catch (e) {
            console.error('❌ [TAGALL] Erreur:', e.message);
            await sock.sendMessage(ctx.from, { text: `⚠️ La mention générale n’a pas pu être envoyée.\n_Raison : ${e.message}_` }, { quoted: replyTarget });
        }
    }
};
