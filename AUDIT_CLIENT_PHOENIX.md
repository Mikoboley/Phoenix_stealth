# Audit Phoenix Stealth v20

## Synthèse

Phoenix Stealth est un bot WhatsApp Node.js/Baileys compact, déjà relativement structuré : séparation `core/` / `commands/`, résolution des noms, cache de messages, suivi de présence, pairing persistant et contrôles de syntaxe existants.

La base est exploitable : les tests présents passent et `npm audit --omit=dev --audit-level=high` ne remonte aucune vulnérabilité élevée dans l’état audité.

Le principal manque n’était pas fonctionnel mais **présentationnel** : la route web racine affichait seulement `Noyau Phoenix Actif.`, et le menu WhatsApp était dense et peu orienté premier démarrage.

## Corrections appliquées

### 1. Accueil web client

- Remplacement de la réponse texte brute de `/` par une page responsive en français.
- Ajout d’une hiérarchie visuelle : identité Phoenix, message d’accueil, statut opérationnel et version.
- Design sombre sobre, cartes arrondies, contraste lisible, rendu adapté mobile et desktop.
- Ajout de `/healthz`, endpoint JSON minimal pour la supervision : statut, service et uptime.
- Aucune donnée sensible ou information de session n’est exposée.

### 2. Menu WhatsApp

- Ajout d’une section « Pour commencer ».
- Réduction des séparateurs visuels répétitifs.
- Regroupement plus lisible par usages : surveillance, présence, média/groupe, outils, système.
- Reformulation plus chaleureuse et plus claire pour un utilisateur final.
- Conservation des commandes existantes et des exemples utiles.

### 3. Nettoyage des médias expirés

Le nettoyage horaire supprimait auparavant les entrées du cache après 24 h mais pouvait laisser les fichiers image/vidéo/audio dans `Phoenix_Media/statuses/`. Le code supprime maintenant aussi le fichier local associé lors de l’expiration.

### 4. Validation des rappels

Le parser acceptait des formats partiellement valides comme `10mfoo` en interprétant seulement `10m`. Les formats sont désormais strictement contrôlés (`30s`, `10m`, `1h`, ou combinaisons conformes) avant programmation.

### 5. Documentation

- Titre mis à jour en v20.
- Document des routes web et des améliorations visibles.
- Ajout des notes sur le nettoyage disque et la validation des rappels.

## Vérifications réalisées

- `npm run check:syntax` : OK.
- `node scripts_v16_test.js` : OK.
- `node --check index.js` : OK.
- `node --check commands/menu.js` : OK.
- `node --check commands/remind.js` : OK.
- Test ciblé : `10mfoo` est refusé : OK.
- Smoke test serveur sur un port local : `/` répond avec la page Phoenix et `/healthz` répond avec `status: ok`.
- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité signalée.

## Points forts conservés

- Propriétaire limité par `isOwner` avant exécution des commandes.
- Noms du carnet prioritaires sur les noms de profil.
- JID de groupes, newsletters et broadcasts exclus du carnet personnel.
- Différenciation honnête entre présence observée et simple joignabilité RTT.
- Session Baileys séparée dans `auth_info/` et données locales séparées dans `Phoenix_Media/`.
- Logs sensibles filtrés par défaut.

## Points à traiter dans une prochaine itération

### Priorité élevée

1. **Tests automatisés plus larges** : le test actuel couvre surtout des cas ciblés. Ajouter des tests pour `remind`, `contacts`, `displayNames`, les erreurs de média et les reconnexions.
2. **Gestion des rappels** : les rappels sont en mémoire uniquement et sont perdus lors d’un redémarrage. Une petite persistance locale et une commande `!remind list/cancel` rendraient la fonction plus fiable.
3. **Gestion des exceptions fatales** : le handler `uncaughtException` journalise puis laisse le processus continuer. En production, il est préférable de fermer proprement ou de déléguer le redémarrage à un process manager.
4. **Limites de stockage** : ajouter une taille maximale de cache et une stratégie de quota pour les médias afin de protéger le disque avant le nettoyage 24 h.

### Priorité moyenne

1. `syncFullHistory: true` peut être lourd sur un compte avec beaucoup d’historique ; rendre ce choix configurable selon l’environnement.
2. Plusieurs blocs `catch` silencieux compliquent le diagnostic ; journaliser un identifiant de contexte en mode verbose améliorerait le support.
3. La cible des commandes `!type`, `!record` et `!stop` est principalement interprétée comme un numéro ; retourner une erreur explicite quand l’argument n’est pas exploitable serait plus accueillant.
4. `core/contacts.js` contient `captureGroup()` comme fonction inactive ; elle peut être supprimée ou implémentée clairement pour réduire la dette technique.
5. Le fichier `README_V16.md` est historiquement nommé v16 malgré son titre v20 ; le renommer en `README.md` serait plus professionnel lors de la prochaine livraison.

## Point de vigilance produit

Les fonctions de récupération de vues uniques, de messages supprimés, de simulation de présence et d’envoi multiple sont sensibles du point de vue de la confiance utilisateur et des règles de la plateforme. Pour une présentation client, il est recommandé de documenter clairement leur périmètre, leur activation propriétaire et les limites liées à WhatsApp, sans les présenter comme une surveillance garantie.

## Conclusion

Le dépôt est propre pour une base de bot personnelle et les risques techniques immédiats sont limités. La v20 améliore maintenant le premier contact client et corrige deux défauts concrets de fiabilité/maintenance. La prochaine étape à plus forte valeur serait un petit socle de tests et une gestion persistante des rappels, avant d’ajouter de nouvelles fonctionnalités.
