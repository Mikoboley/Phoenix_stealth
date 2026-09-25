# Recherche et correction de la sonde RTT de Phoenix Stealth

## Résumé

La sonde Phoenix utilise le mécanisme vérifié dans les dépôts publics de référence : une suppression silencieuse d’un faux message, l’identifiant réellement retourné par `sendMessage()`, puis l’écoute de `messages.update` et de `CB:receipt`. Le délai d’attente est de dix secondes.

La version actuelle distingue désormais trois niveaux qui ne doivent pas être confondus : **présence explicitement reçue par WhatsApp**, **appareil joignable par accusé**, et **absence de réponse**. Un accusé de livraison ne prouve pas que WhatsApp est affiché au premier plan ; seul un événement `presence.update` portant `available`, `composing` ou `recording` constitue cette preuve directe.

## Correction des noms

Les notifications de vue unique, de statut et de message supprimé utilisent maintenant le résolveur du carnet WhatsApp sans repli automatique sur `pushName`. Le `pushName` est un nom de profil et ne doit pas remplacer le nom enregistré par l’utilisateur. Les LID sont convertis vers leur numéro lorsque Baileys fournit le mapping, sans être affichés comme des contacts séparés.

Le secret interne `messageContextInfo.messageSecret` n’est plus affiché comme contenu d’un message supprimé. Il s’agit de métadonnées cryptographiques et non du texte envoyé par l’utilisateur.

## Correction du carnet

Les JID `@g.us`, `@newsletter` et `@broadcast` sont exclus du carnet personnel lors du chargement, de la synchronisation et de l’affichage. Les JID PN et les JID d’appareils liés sont normalisés vers un seul contact lorsque cela est possible. Les personnes distinctes portant le même nom restent conservées.

## Méthode online

La commande `online` ne renvoie plus un résultat de cache comme s’il s’agissait de l’état actuel. Elle lance une nouvelle observation. Les résultats sont libellés ainsi :

| Preuve reçue | Affichage |
|---|---|
| `presence.update: available` | En ligne confirmé |
| `presence.update: composing` | En train d’écrire |
| `presence.update: recording` | En train d’enregistrer |
| `DELIVERY_ACK`, `inactive` ou `CB:receipt` | Joignable, accusé reçu |
| Aucun événement pendant dix secondes | Aucune réponse de la sonde |

Le RTT sert à mesurer la rapidité de réponse et à calibrer la sonde. Il ne sert pas, à lui seul, à prétendre que l’application est au premier plan.

## Limite incontournable

WhatsApp ne fournit pas toujours un événement de présence immédiat pour un contact qui est actuellement en ligne, notamment si la présence est masquée, si l’événement n’a pas changé, ou si l’appareil lié n’émet pas l’événement vers cette session. Dans ce cas, le résultat exact que le bot peut affirmer est **joignable**, pas **au premier plan**. Le code préfère maintenant cette réponse honnête à une classification inventée à partir du RTT.

## Validation

La syntaxe de `index.js`, de tous les fichiers `core/` et de toutes les commandes passe. Le chargeur vérifie le chargement des 18 commandes. Les tests locaux couvrent le filtrage des chaînes et groupes, la déduplication PN/appareil, la résolution par nom du carnet, la présence d’un appareil lié et l’exclusion du secret interne des messages supprimés.
