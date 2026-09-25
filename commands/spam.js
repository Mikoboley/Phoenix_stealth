const activeSpams = new Map();

module.exports = {
    name: 'spam',
    aliases: ['flood'],
    description: 'Envoie N messages',
    activeSpams,
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const n = Number.parseInt(ctx.args[0], 10);
        const txt = ctx.args.slice(1).join(' ').trim();

        if (!Number.isInteger(n) || !txt || n < 1 || n > 30) {
            await sock.sendMessage(myJid, { text: '╭━━━〔 ⚠️ SPAM 〕━━━╮\n┃ Usage : `!spam <nombre> <texte>`\n┃ Limite : 30 messages maximum.\n╰━━━━━━━━━━━━━━━━━━╯' });
            return;
        }
        if (activeSpams.has(ctx.from)) {
            await sock.sendMessage(myJid, { text: '⚠️ Un envoi multiple est déjà en cours ici.\n💡 Utilise `!spamstop` pour l’arrêter.' });
            return;
        }

        const controller = { cancelled: false };
        activeSpams.set(ctx.from, controller);
        let sent = 0;

        try {
            for (let i = 0; i < n && !controller.cancelled; i++) {
                await sock.sendMessage(ctx.from, { text: txt });
                sent++;
                if (i < n - 1 && !controller.cancelled) {
                    await new Promise((resolve) => setTimeout(resolve, 600));
                }
            }
            await sock.sendMessage(myJid, {
                text: controller.cancelled
                    ? `╭━━━〔 🛑 SPAM ARRÊTÉ 〕━━━╮\n┃ 📤 ${sent} message(s) envoyé(s)\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
                    : `╭━━━〔 ✅ ENVOI TERMINÉ 〕━━━╮\n┃ 📤 ${sent} message(s) envoyé(s)\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
            });
        } finally {
            if (activeSpams.get(ctx.from) === controller) activeSpams.delete(ctx.from);
        }
    }
};
