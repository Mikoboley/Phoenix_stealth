module.exports = {
    name: 'clean',
    aliases: ['purge'],
    description: 'Vide le cache',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        botState.cacheMessages.clear();
        await sock.sendMessage(myJid, { text: "╭━━━〔 🧹 NETTOYAGE 〕━━━╮\n┃ ✅ Cache mémoire vidé\n┃ 🌿 Phoenix est plus léger.\n╰━━━━━━━━━━━━━━━━━━━━╯" });
    }
};
