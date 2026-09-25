module.exports = {
    name: 'ping',
    aliases: ['p'],
    description: 'Latence',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const latence = Date.now() - (msg.messageTimestamp * 1000 || Date.now());
        await sock.sendMessage(myJid, { text: `╭━━━〔 🦅 PHOENIX PULSE 〕━━━╮\n┃ 🏓 *Pong !*\n┃ ⚡ Latence : \`${latence} ms\`\n┃ 🟢 État : opérationnel\n╰━━━━━━━━━━━━━━━━━━━━━━╯` });
    }
};
