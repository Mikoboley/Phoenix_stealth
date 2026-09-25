const { getStats, formatUptime, resetStats } = require('../core/stats');

module.exports = {
    name: 'stats',
    aliases: ['statistiques', 'usage'],
    description: 'Affiche les statistiques d’usage du bot',
    async execute(sock, msg, botState, ctx) {
        const arg = ctx.args[0]?.toLowerCase();
        if (arg === 'reset') {
            resetStats();
            await sock.sendMessage(ctx.from, {
                text: '╭━━━〔 🧹 STATISTIQUES 〕━━━╮\n┃ ✅ Compteurs remis à zéro.\n┃ 📈 Phoenix repart sur une base propre.\n╰━━━━━━━━━━━━━━━━━━━━━━╯'
            }, { quoted: msg });
            return;
        }

        const s = getStats();
        let text = `╭━━━〔 📊 PHOENIX STATS 〕━━━╮\n`;
        text += `┃ 🟢 État : actif\n`;
        text += `┃ ⏱️ Uptime : *${formatUptime(s.uptimeMs)}*\n`;
        text += `┣━━━━━━━━━━━━━━━━━━━━━━┫\n`;
        text += `┃ 📥 Messages reçus : ${s.messagesReceived}\n`;
        text += `┃ 📤 Messages envoyés : ${s.messagesSent}\n`;
        text += `┃ 🎯 Commandes exécutées : ${s.commandsExecuted}\n`;

        if (s.lastCommandName) {
            const lastTime = new Date(s.lastCommandAt).toLocaleTimeString('fr-FR');
            text += `┣━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            text += `┃ 🕘 Dernière : *!${s.lastCommandName}*\n`;
            text += `┃ 🕐 Heure : ${lastTime}\n`;
        }
        if (s.topCommands.length > 0) {
            text += `┣━━━━━━━━━━━━━━━━━━━━━━┫\n┃ 🏆 Commandes favorites\n`;
            for (let i = 0; i < s.topCommands.length; i++) {
                const [name, count] = s.topCommands[i];
                const medal = ['🥇', '🥈', '🥉', '▫️', '▫️'][i] || '▫️';
                text += `┃ ${medal} !${name} — ${count} fois\n`;
            }
        }
        text += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n💡 Utilise !stats reset pour réinitialiser.`;
        await sock.sendMessage(ctx.from, { text }, { quoted: msg });
    }
};
