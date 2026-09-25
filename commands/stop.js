const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { resolveDisplayName } = require('../core/displayNames');

module.exports = {
    name: 'stop',
    aliases: ['arrete'],
    description: 'Arrête les simulations',
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

        if (botState.activeIntervals[targetJid]) {
            clearInterval(botState.activeIntervals[targetJid]);
            delete botState.activeIntervals[targetJid];
        }
        try { await sock.sendPresenceUpdate('paused', targetJid); } catch (e) { }

        await sock.sendMessage(myJid, { text: `╭━━━〔 🛑 PHOENIX STOP 〕━━━╮\n┃ ✅ Simulations arrêtées\n┃ 👤 Cible : *${targetDisplay}*\n┃ 🌿 La présence est revenue à la normale.\n╰━━━━━━━━━━━━━━━━━━━━━━╯` });
    }
};
