module.exports = {
    name: 'menu',
    aliases: ['help', 'aide'],
    description: 'Menu élégant des commandes',
    async execute(sock, msg, botState, ctx) {
        const myJid = `${String(botState.PHONE_NUMBER).replace(/\D/g, '')}@s.whatsapp.net`;
        const mText =
`🦅 *PHOENIX STEALTH*
_Le centre de contrôle de ton assistant WhatsApp_

━━━━━━━━━━━━━━━━━━━━
👁️ *SURVEILLANCE*
━━━━━━━━━━━━━━━━━━━━
• *!statut [nom]* — Voir les statuts non lus
• *!statut download [nom]* — Lister les statuts disponibles
• *!statut download <nom> -1* — Télécharger le dernier statut
• *!online [nom ou numéro]* — Vérifier la présence
• *!alertonline [nom] | message* — Alerte personnalisée en ligne
• *!alertonline list/off [nom]* — Gérer les alertes
• *!viewonce* ou *!vv* — Récupérer une vue unique

━━━━━━━━━━━━━━━━━━━━
🎭 *PRÉSENCE*
━━━━━━━━━━━━━━━━━━━━
• *!type [numéro]* — Afficher « écrit… »
• *!record [numéro]* — Afficher « enregistre… »
• *!stop [numéro]* — Arrêter une simulation

━━━━━━━━━━━━━━━━━━━━
🎨 *MÉDIA & GROUPE*
━━━━━━━━━━━━━━━━━━━━
• *!sticker [position] [texte]* — Créer un sticker
• *!tagall [message]* — Mentionner le groupe (répond au message cité)
• *!contacts [page]* — Parcourir le carnet
• *!contact [nom]* — Ouvrir une fiche contact

━━━━━━━━━━━━━━━━━━━━
⚡ *OUTILS*
━━━━━━━━━━━━━━━━━━━━
• *!remind 10m message* — Programmer un rappel
• *!spam 3 message* — Envoyer plusieurs messages
• *!spamstop* — Arrêter un envoi multiple

━━━━━━━━━━━━━━━━━━━━
🛠️ *SYSTÈME*
━━━━━━━━━━━━━━━━━━━━
• *!ping* — Tester la réactivité
• *!runtime* — Voir le temps d’activité
• *!stats* — Voir les statistiques
• *!health* — Diagnostic privé du noyau Phoenix
• *!clean* — Vider le cache mémoire

━━━━━━━━━━━━━━━━━━━━
💡 *Exemple :* !statut Marie
🟢 _Phoenix est prêt._`;
        await sock.sendMessage(myJid, { text: mText });
    }
};
