const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { resolveDisplayName } = require('../core/displayNames');

module.exports = {
    name: 'viewonce',
    aliases: ['vv', 'vo'],
    description: 'Récupère un View Once en réponse (envoie dans ton DM)',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;

        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = quoted?.quotedMessage;
        const quotedId = quoted?.stanzaId;

        if (!quotedMsg || !quotedId) {
            await sock.sendMessage(myJid, {
                text: '╭━━━〔 👁️ VUE UNIQUE 〕━━━╮\n┃ ⚠️ Réponds à une image, vidéo ou\n┃ audio à vue unique avec `!vv`.\n╰━━━━━━━━━━━━━━━━━━━━╯'
            });
            return;
        }

        const quotedKey = {
            remoteJid: ctx.from,
            fromMe: false,
            id: quotedId,
            participant: quoted?.participant
        };

        try {
            const buffer = await downloadMediaMessage(
                { key: quotedKey, message: quotedMsg },
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: sock.reuploadRequest }
            );

            if (!buffer) {
                await sock.sendMessage(myJid, { text: '⚠️ Ce média n’est plus disponible.\n_Il a peut-être déjà été consulté ou expiré._' });
                return;
            }

            const inner = quotedMsg.viewOnceMessageV2?.message
                || quotedMsg.viewOnceMessage?.message
                || quotedMsg.viewOnceMessageV2Extension?.message
                || quotedMsg;

            const type = Object.keys(inner)[0];
            const senderJid = quoted?.participant || ctx.from;
            const display = await resolveDisplayName(sock, senderJid, botState, msg.pushName);
            const header = `╭━━━〔 👁️ VUE UNIQUE RÉCUPÉRÉE 〕━━━╮\n┃ 👤 De : *${display.name}*\n┃ 💬 Dans : ${ctx.from.endsWith('@g.us') ? 'un groupe' : 'une discussion privée'}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            if (type === 'imageMessage') {
                await sock.sendMessage(myJid, { image: buffer, caption: header });
            } else if (type === 'videoMessage') {
                await sock.sendMessage(myJid, { video: buffer, caption: header });
            } else if (type === 'audioMessage' || type === 'pttMessage') {
                const meta = inner.audioMessage || inner.pttMessage;
                await sock.sendMessage(myJid, { text: header });
                await sock.sendMessage(myJid, { audio: buffer, mimetype: meta?.mimetype || 'audio/ogg; codecs=opus', ptt: true });
            } else {
                await sock.sendMessage(myJid, { text: `⚠️ Ce type de vue unique n’est pas encore pris en charge : ${type}` });
            }

        } catch (e) {
            await sock.sendMessage(myJid, { text: `⚠️ Impossible de récupérer ce média.\n_Raison : ${e.message}_` });
        }
    }
};
