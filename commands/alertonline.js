const { add, remove } = require('../core/onlineAlerts');

module.exports = {
    name: 'alertonline',
    aliases: ['onlinealert', 'alerteonline'],
    description: 'Alerte personnalisée lorsqu’un contact devient disponible',
    async execute(sock, msg, botState, ctx) {
        const args = [...ctx.args];
        const first = (args[0] || '').toLowerCase();
        const action = ['list', 'liste', 'off', 'remove', 'supprimer'].includes(first) ? args.shift().toLowerCase() : '';
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;

        if (!action && !args.length) {
            const alerts = Object.values(botState.onlineAlerts || {});
            const text = alerts.length
                ? `╭━━━〔 🔔 ALERTES ONLINE 〕━━━╮\n┃ ${alerts.map(a => `👤 *${a.name}*\n┃ ✉️ ${a.message}`).join('\n┣━━━━━━━━━━━━━━━━━━━━━━┫\n')}\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
                : '╭━━━〔 🔔 ALERTES ONLINE 〕━━━╮\n┃ 📭 Aucune alerte configurée.\n╰━━━━━━━━━━━━━━━━━━━━━━╯';
            await sock.sendMessage(myJid, { text }, { quoted: msg });
            return;
        }

        if (action === 'list' || action === 'liste') {
            const alerts = Object.values(botState.onlineAlerts || {});
            const text = alerts.length
                ? `╭━━━〔 🔔 ALERTES ONLINE 〕━━━╮\n┃ ${alerts.map(a => `👤 *${a.name}*\n┃ ✉️ ${a.message}`).join('\n┣━━━━━━━━━━━━━━━━━━━━━━┫\n')}\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
                : '╭━━━〔 🔔 ALERTES ONLINE 〕━━━╮\n┃ 📭 Aucune alerte configurée.\n╰━━━━━━━━━━━━━━━━━━━━━━╯';
            await sock.sendMessage(myJid, { text }, { quoted: msg });
            return;
        }

        if (action === 'off' || action === 'remove' || action === 'supprimer') {
            const query = args.join(' ').trim();
            const ok = remove(botState, query);
            await sock.sendMessage(myJid, { text: ok ? `✅ Alerte supprimée pour *${query}*.` : `⚠️ Aucune alerte trouvée pour *${query}*.` }, { quoted: msg });
            return;
        }

        let query = args.join(' ').trim();
        let message = '';
        if (query.includes('|')) {
            const parts = query.split('|');
            query = parts.shift().trim();
            message = parts.join('|').trim();
        }
        // Sans séparateur, tous les arguments désignent le contact ; le
        // message personnalisé reste optionnel.
        if (!query && args.length) query = args.join(' ').trim();
        const result = await add(sock, botState, query, message);
        if (!result.ok) {
            await sock.sendMessage(myJid, { text: `⚠️ ${result.error}\n\nExemple : !alertonline Blue Bird | 🔔 {name} est disponible.` }, { quoted: msg });
            return;
        }
        await sock.sendMessage(myJid, {
            text: `╭━━━〔 ✅ ALERTE ACTIVÉE 〕━━━╮\n┃ 👤 Contact : *${result.alert.name}*\n┃ 💬 Message : ${result.alert.message}\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: msg });
    }
};

// Utilisation :
// !alertonline <nom|numéro> | message facultatif
// !alertonline list
// !alertonline off <nom|numéro>
