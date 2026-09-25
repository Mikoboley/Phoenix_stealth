module.exports = {
    name: 'remind',
    aliases: ['rappel', 'r'],
    description: 'Programme un rappel',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;

        if (ctx.args.length < 2) {
            await sock.sendMessage(myJid, {
                text: '╭━━━〔 ⏰ RAPPEL 〕━━━╮\n┃ Usage : `!remind <durée> <message>`\n┃ Exemples : `30s`, `10m`, `1h`\n╰━━━━━━━━━━━━━━━━━━╯'
            });
            return;
        }

        const durationStr = ctx.args[0].toLowerCase();
        const text = ctx.args.slice(1).join(' ');

        const regex = /^(?=.{2,12}$)(?:\d+[smh])+$/;
        let match;
        let totalMs = 0;
        let matched = false;

        const parts = durationStr.match(/(\d+)([smh])/g) || [];
        for (const part of parts) {
            match = part.match(/(\d+)([smh])/);
            const value = Number.parseInt(match[1], 10);
            const unit = match[2];
            matched = true;
            if (unit === 's') totalMs += value * 1000;
            else if (unit === 'm') totalMs += value * 60 * 1000;
            else if (unit === 'h') totalMs += value * 60 * 60 * 1000;
        }

        if (!regex.test(durationStr) || !matched || totalMs === 0 || totalMs > 24 * 60 * 60 * 1000) {
            await sock.sendMessage(myJid, { text: '⚠️ Durée invalide. Utilise `s`, `m` ou `h` — maximum 24 h.' });
            return;
        }

        const target = new Date(Date.now() + totalMs);
        const hh = String(target.getHours()).padStart(2, '0');
        const mm = String(target.getMinutes()).padStart(2, '0');

        await sock.sendMessage(myJid, { text: `╭━━━〔 ⏰ RAPPEL PROGRAMMÉ 〕━━━╮\n┃ 🕐 Heure : *${hh}:${mm}*\n┃ 📝 Message : ${text}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯` });

        setTimeout(async () => {
            try {
                await sock.sendMessage(myJid, { text: `╭━━━〔 🔔 RAPPEL 〕━━━╮\n┃ 📝 ${text}\n╰━━━━━━━━━━━━━━━━━━╯` });
            } catch (e) { }
        }, totalMs);
    }
};
