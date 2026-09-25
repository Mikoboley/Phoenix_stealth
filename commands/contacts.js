const { getAllContacts, deleteContactByName } = require('../core/contacts');

module.exports = {
    name: 'contacts',
    aliases: ['liste', 'carnet'],
    description: 'Parcourt le carnet WhatsApp',
    async execute(sock, msg, botState, ctx) {
        const subCmd = ctx.args[0]?.toLowerCase();

        if (subCmd === 'del' || subCmd === 'supprimer') {
            const name = ctx.args.slice(1).join(' ').trim();
            if (!name) {
                await sock.sendMessage(ctx.from, { text: '⚠️ Utilise : !contacts del <nom>' }, { quoted: msg });
                return;
            }
            const deleted = deleteContactByName(name);
            const text = deleted.length
                ? `✅ ${deleted.length} contact(s) retiré(s) du cache local.\n${deleted.map(d => `• ${d.name}`).join('\n')}`
                : `📭 Aucun contact correspondant à *${name}*.`;
            await sock.sendMessage(ctx.from, { text }, { quoted: msg });
            return;
        }

        const all = getAllContacts();
        if (!all.length) {
            await sock.sendMessage(ctx.from, { text: '📭 Aucun contact synchronisé pour le moment.\n⏳ Laisse Phoenix terminer la synchronisation WhatsApp.' }, { quoted: msg });
            return;
        }

        const numericPage = /^\d+$/.test(subCmd || '') ? Math.max(1, Number(subCmd)) : 1;
        const search = subCmd && !/^\d+$/.test(subCmd) ? ctx.args.join(' ').toLowerCase() : '';
        const filtered = search ? all.filter(c => c.name.toLowerCase().includes(search)) : all;
        const pageSize = 35;
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const page = Math.min(numericPage, pages);
        const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

        let text = `📇 *CARNET WHATSAPP*\n`;
        text += `_${filtered.length} contact(s) • page ${page}/${pages}_\n\n`;
        text += slice.map((c, i) => `${(page - 1) * pageSize + i + 1}. 👤 ${c.name}`).join('\n');
        text += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
        if (pages > 1) text += `➡️ Page suivante : !contacts ${page < pages ? page + 1 : 1}\n`;
        text += `🔎 Recherche : !contacts <nom>`;
        if (search) text += `\n🧹 Résultats filtrés pour : ${search}`;

        await sock.sendMessage(ctx.from, { text }, { quoted: msg });
    }
};
