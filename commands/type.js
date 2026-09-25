const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { resolveDisplayName } = require('../core/displayNames');

module.exports = {
    name: 'type',
    aliases: ['ecrit'],
    description: 'Simule la frappe',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const arg = ctx.args.join(' ').trim();
        let targetJid = ctx.from;
        let targetDisplay = "Contact WhatsApp";

        if (arg) targetJid = `${arg.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        targetJid = jidNormalizedUser(targetJid);

        if (targetJid.endsWith('@g.us')) {
            try { targetDisplay = (await sock.groupMetadata(targetJid)).subject; } catch { targetDisplay = "Ce Groupe"; }
        } else targetDisplay = (await resolveDisplayName(sock, targetJid, botState, ctx.from === targetJid ? msg.pushName : '')).name;

        if (botState.activeIntervals[targetJid]) clearInterval(botState.activeIntervals[targetJid]);
        try {
            await sock.sendPresenceUpdate('available', targetJid);
            await sock.sendPresenceUpdate('composing', targetJid);
        } catch (e) { }

        botState.activeIntervals[targetJid] = setInterval(async () => {
            if (botState.currentSock !== sock) {
                clearInterval(botState.activeIntervals[targetJid]);
                delete botState.activeIntervals[targetJid];
                return;
            }
            try { await sock.sendPresenceUpdate('composing', targetJid); }
            catch (err) {
                clearInterval(botState.activeIntervals[targetJid]);
                delete botState.activeIntervals[targetJid];
            }
        }, 8000);

        await sock.sendMessage(myJid, { text: `╭━━━〔 ✍️ GHOST TYPE 〕━━━╮\n┃ ✅ Simulation activée\n┃ 👤 Cible : *${targetDisplay}*\n┃ 🔁 Arrêt : !stop\n╰━━━━━━━━━━━━━━━━━━━━━━╯` });
    }
};
