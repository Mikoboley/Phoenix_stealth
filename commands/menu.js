module.exports = {
    name: 'menu',
    aliases: ['help', 'aide'],
    description: 'Menu élégant des commandes',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const mText =
`╭━━━〔 🦅 PHOENIX STEALTH 〕━━━╮
┃ Ton centre de contrôle WhatsApp
┃ Simple, discret et prêt à t’aider.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

✨ *POUR COMMENCER*
• *!statut* — Voir les statuts non lus
• *!menu* — Afficher ce guide
• *!health* — Vérifier que tout va bien

👁️ *SURVEILLANCE*
• *!statut [nom]* — Ouvrir les statuts d’un contact
• *!statut download [nom]* — Lister les téléchargements
• *!statut download <nom> -1* — Récupérer le dernier
• *!online [nom ou numéro]* — Observer la présence
• *!alertonline [nom] | message* — Créer une alerte
• *!alertonline list/off [nom]* — Gérer les alertes
• *!viewonce* / *!vv* — Récupérer une vue unique

🎭 *PRÉSENCE*
• *!type [numéro]* — Afficher « écrit… »
• *!record [numéro]* — Afficher « enregistre… »
• *!stop [numéro]* — Arrêter une simulation

🎨 *MÉDIA & GROUPE*
• *!sticker [position] [texte]* — Créer un sticker
• *!tagall [message]* — Mentionner le groupe
• *!contacts [page]* — Parcourir le carnet
• *!contact [nom]* — Ouvrir une fiche contact

⚡ *OUTILS*
• *!remind 10m message* — Programmer un rappel
• *!spam 3 message* — Envoyer plusieurs messages
• *!spamstop* — Arrêter un envoi multiple

🛠️ *SYSTÈME*
• *!ping* · *!runtime* · *!stats* — Suivi rapide
• *!clean* — Vider le cache mémoire

💡 *Exemple :* \`!statut Marie\`
🌿 _Phoenix est prêt. Bonne utilisation !_`;
        await sock.sendMessage(myJid, { text: mText });
    }
};
