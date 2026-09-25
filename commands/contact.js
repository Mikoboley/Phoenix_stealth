const { getAllContacts } = require('../core/contacts');
const { resolveDisplayName } = require('../core/displayNames');

module.exports = {
    name: 'contact',
    aliases: ['whois', 'fiche'],
    description: 'Affiche la fiche d’un contact du carnet',
    async execute(sock, msg, botState, ctx) {
        const query = ctx.args.join(' ').trim().toLowerCase();
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        if (!query) {
            await sock.sendMessage(myJid, { text: '⚠️ Utilise : !contact <nom>' });
            return;
        }

        const match = getAllContacts().find(c => c.name.toLowerCase().includes(query));
        if (!match) {
            await sock.sendMessage(myJid, { text: `📭 Aucun contact trouvé pour *${query}*.` });
            return;
        }

        const display = await resolveDisplayName(sock, match.jid, botState, match.name);
        const online = botState.onlineUsers?.has(match.jid);
        const text = `📇 *FICHE CONTACT*\n\n` +
            `👤 Nom : *${display.name}*\n` +
            `📡 Présence connue : ${online ? '🟢 active' : '⚫ non active'}\n\n` +
            `💡 Utilise !online ${display.name} pour actualiser sa présence.`;
        await sock.sendMessage(myJid, { text });
    }
};
