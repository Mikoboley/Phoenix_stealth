function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: 'health',
    aliases: ['diagnostic', 'etat'],
    description: 'Affiche l’état général de Phoenix en privé',
    async execute(sock, msg, botState) {
        const { commands } = require('../core/commands');
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const statusCount = Object.values(botState.statusCache || {})
            .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
        const onlineCount = botState.onlineUsers instanceof Map ? botState.onlineUsers.size : Object.keys(botState.onlineUsers || {}).length;
        const alertCount = Object.values(botState.onlineAlerts || {}).filter((alert) => alert.enabled !== false).length;
        const text = `╭━━━〔 🩺 PHOENIX HEALTH 〕━━━╮
┃ 🟢 Noyau : actif
┃ ⏱️ Uptime : ${formatDuration(Date.now() - botState.START_TIME)}
┃ 🧩 Commandes : ${new Set(commands.values()).size}
┃ 📇 Contacts : ${Object.keys(botState.contactNames || {}).length}
┃ 👁️ Statuts en cache : ${statusCount}
┃ 🟢 Présences suivies : ${onlineCount}
┃ 🔔 Alertes actives : ${alertCount}
╰━━━━━━━━━━━━━━━━━━━━━━━━╯`;
        await sock.sendMessage(myJid, { text }, { quoted: msg });
    }
};
