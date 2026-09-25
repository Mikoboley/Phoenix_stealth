# Recherche complémentaire — présence WhatsApp et bots comparables

## Résultat principal pour `!online`

Baileys expose officiellement cinq signaux principaux : `available`, `unavailable`, `composing`, `recording` et `paused`. La documentation décrit `available` comme un utilisateur en ligne et actif, tandis que `unavailable` signifie hors ligne **ou application en arrière-plan**. `composing` et `recording` sont les seuls signaux directs d’une activité observable au moment de l’événement. Baileys ne fournit pas un champ séparé et garanti nommé « application au premier plan ».[1]

La commande `!online` a donc été reformulée ainsi :

- **Active — écrit actuellement** : événement `composing` reçu.
- **Active — enregistre actuellement** : événement `recording` reçu.
- **En ligne — activité non déterminée** : événement `available` reçu.
- **Hors ligne ou application en arrière-plan** : événement `unavailable` reçu.
- **Joignable — activité non confirmée** : accusé RTT reçu sans événement de présence.
- **Aucune présence reçue** : délai dépassé sans signal exploitable.

Cette distinction est plus exacte que de transformer chaque accusé réseau en « en ligne ». Un accusé indique que la cible ou un appareil lié est joignable ; il ne prouve pas que WhatsApp est affiché au premier plan.

L’événement `presence.update` est lui-même dépendant de l’abonnement, des réglages de confidentialité, de la synchronisation, du réseau et du comportement serveur. Un problème ouvert de Baileys documente des cas où aucun événement `available` n’arrive jusqu’à ce que la personne commence à écrire, alors que la présence fonctionne dans une autre bibliothèque.[3] Il faut donc présenter un signal observé avec sa fraîcheur, jamais une certitude absolue.

## Analyse des projets comparables

### Toxic-MD

Toxic-MD est le projet bot le plus utile à étudier techniquement parmi les trois. Son code public montre une liste de présence qui s’abonne aux présences, attend une courte fenêtre, garde les signaux `available`, `composing` et `recording` récents, et applique une limite de participants. Ce modèle est intéressant pour l’interface : état observé, horodatage et durée de fraîcheur, plutôt qu’une affirmation permanente.[4]

Le dépôt possède aussi un résolveur de noms/JID avec cache et résolution contextuelle. C’est une bonne idée d’architecture pour Phoenix, mais elle doit rester séparée de la présence et respecter la règle du carnet WhatsApp.[5]

Toxic-MD implémente également des fonctions de récupération de messages supprimés et de vues uniques. Ces fonctions dépendent cependant du stockage préalable, de la disponibilité du média et du téléchargement réussi. Elles ne garantissent pas une récupération universelle. Le projet reconnaît lui-même les risques liés à l’API non officielle et au bannissement ; il ne faut donc pas copier son code aveuglément.[6]

### WaEnhancer

WaEnhancer est un module Android Xposed/LSPosed, pas un bot Baileys. Il est pertinent comme source d’inspiration UX : affichage discret du statut de présence dans les conversations, règles de confidentialité par contact ou groupe, séparation des groupes et des discussions, et échec explicite lorsque le fichier d’un média n’est plus disponible.[7]

Il n’est pas une base technique appropriée pour Phoenix. Il dépend de hooks dans une application WhatsApp obfusquée, signale des risques d’instabilité et de bannissement, et son architecture est très différente.[8]

### WASI-MD-V7

WASI-MD-V7 annonce de nombreuses fonctions, notamment « Always Online », anti-delete, lecture automatique des statuts, commandes de groupe et téléchargements. L’inspection du dépôt public ne permet toutefois pas de vérifier la plupart de ces annonces : le cœur Baileys est téléchargé depuis l’extérieur et le Dockerfile utilise une image opaque. Le code visible ne contient pas une implémentation complète permettant de vérifier ces comportements.[9]

WASI-MD-V7 ne doit donc pas être utilisé comme référence technique pour la détection online. Il peut seulement servir d’inventaire de commandes annoncées, avec une forte réserve sur leur disponibilité réelle.

## Ce que je recommande de conserver pour Phoenix

1. **Les états explicites de `!online`** déjà appliqués dans cette version.
2. **La notion de fraîcheur** : un événement de présence ne doit pas être conservé comme vérité indéfinie.
3. **La séparation entre présence et RTT** : présence = signal d’activité observé ; RTT = joignabilité réseau ; aucun des deux ne prouve à lui seul que l’application est au premier plan.
4. **La résolution de noms indépendante** : le nom du carnet reste prioritaire sur tout profil ou numéro.
5. **Les échecs explicites** : lorsqu’il n’y a pas de présence ou qu’un média manque, le bot doit le dire au lieu d’inventer un état.

Je ne recommande pas d’ajouter maintenant une nouvelle fonctionnalité. Les idées repérées dans les dépôts — liste de présence de groupe, réglages de confidentialité par contact, historique de présence, digest d’alertes et badges de fraîcheur — peuvent faire l’objet d’une proposition séparée. Elles ne sont pas ajoutées dans cette version conformément à ta demande.

## Modifications réalisées dans Phoenix

- Suppression de la commande `!onlineall`.
- Suppression de sa mention dans le menu et la documentation.
- `!online` distingue maintenant activité observable, présence en ligne non qualifiée, arrière-plan/hors ligne et joignabilité RTT.
- Le tracker transmet également le champ `lastSeen` lorsqu’il est fourni par WhatsApp/Baileys.
- Aucun nouveau module fonctionnel n’a été ajouté dans cette étape.

## Références

[1]: https://baileys.wiki/features/presence "Baileys — Presence"
[2]: https://baileys.wiki/faq "Baileys — FAQ"
[3]: https://github.com/WhiskeySockets/Baileys/issues/198 "Baileys issue #198 — Not getting presence after subscribing"
[4]: https://raw.githubusercontent.com/xhclintohn/Toxic-MD/main/plugins/Groups/listonline.js "Toxic-MD — listonline"
[5]: https://raw.githubusercontent.com/xhclintohn/Toxic-MD/main/lib/usernameResolver.js "Toxic-MD — username resolver"
[6]: https://github.com/xhclintohn/Toxic-MD "Toxic-MD — repository"
[7]: https://github.com/Dev4Mod/waenhancer/blob/master/app/src/main/java/com/wmods/wppenhacer/xposed/features/customization/ShowOnline.kt#L33-L50 "WaEnhancer — ShowOnline"
[8]: https://github.com/Dev4Mod/waenhancer "WaEnhancer — repository"
[9]: https://github.com/Itxxwasi/WASI-MD-V7/blob/main/start.js "WASI-MD-V7 — external core loader"
