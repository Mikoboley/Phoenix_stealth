const { activeSpams } = require('./spam');

module.exports = {
    name: 'spamstop',
    aliases: ['stopspam'],
    description: 'Arrête un spam en cours',
    async execute(sock, msg, botState, ctx) {
        const controller = activeSpams.get(ctx.from);

        if (!controller) {
            await sock.sendMessage(ctx.from, {
                text: '📭 Aucun envoi multiple n’est actif dans ce chat.'
            }, { quoted: msg });
            return;
        }

        controller.cancelled = true;
        activeSpams.delete(ctx.from);

        await sock.sendMessage(ctx.from, {
            text: '╭━━━〔 🛑 SPAMSTOP 〕━━━╮\n┃ ✅ Envoi multiple arrêté.\n┃ 🌿 Phoenix est de nouveau au calme.\n╰━━━━━━━━━━━━━━━━━━━━╯'
        }, { quoted: msg });

        console.log('🛑 [SPAMSTOP] Spam annulé');
    }
};
