# Salle à la maison

Application de suivi de séances de musculation à domicile : programme en 3 séances,
guidage exercice par exercice, minuteur avec alerte sonore, historique, et un
niveau de difficulté qui monte quand la séance devient trop facile.

Site statique, aucune dépendance, aucun build. Tout tient dans `index.html`.

## Déployer

Le dépôt se publie tel quel sur GitHub Pages : Settings → Pages → Source
« Deploy from a branch », branche `main`, dossier `/ (root)`.
Chaque `git push` redéploie en une minute environ.

## Modifier

- Le programme (séances, exercices, séries, repos, consignes) : constante `PROGRAM`, section 1 de `index.html`.
- Le matériel par défaut : `DEFAULT_GEAR`, même section. Modifiable aussi depuis l'écran « Matériel » de l'app.
- Le style : bloc `<style>` en haut du fichier.

Après modification, penser à `git push` : le service worker sert le réseau en
priorité, donc la nouvelle version arrive dès que le téléphone est connecté.

## Accueil

L'écran d'accueil liste les exercices de la prochaine séance avec leurs
paramètres tels qu'ils seront proposés — séries, répétitions, charge ou durée,
récupération — niveau de difficulté compris.

La séance mise en avant suit le cycle A → B → C, sauf quand la semaine en cours
ne compte aucune séance : le programme est hebdomadaire, on repart alors de A
plutôt que de reprendre le cycle laissé en plan la semaine d'avant.

## Illustrations et vidéos

Chaque exercice est accompagné, pendant la séance, d'un schéma montrant la
position à prendre, et d'un lien « Voir une vidéo de l'exercice ».

Les schémas sont du SVG écrit directement dans `index.html` : rien à
télécharger, ils s'affichent hors ligne comme le reste. Ils donnent la position
et le placement du matériel, pas le détail du geste — les consignes de
l'exercice et la vidéo sont là pour ça. Pour modifier ou ajouter une figure :
constante `FIG`, section 1 bis, un exercice n'y est qu'une liste d'articulations
dans un repère 120×80.

Le lien vidéo ouvre une **recherche** plutôt qu'une vidéo précise : une adresse
de vidéo finit toujours par mourir, une recherche non, et elle remonte ce qui se
fait de mieux au moment où on la lance. C'est le seul élément de l'app qui
demande le réseau.

## Niveau de difficulté

Chaque séance (A, B, C) porte son propre niveau, conservé d'une fois sur l'autre
et inscrit dans l'historique. Le bouton « Trop facile », en bas de l'écran de
séance ou sur le résumé de fin, monte d'un cran.

Un cran suit une progression double, dans cet ordre :

1. une répétition de plus ;
2. puis le cran de charge suivant, avec retour aux répétitions de départ —
   uniquement une charge que la barre sait composer ;
3. puis, quand l'inventaire est au maximum, cinq secondes de récupération en
   moins, jusqu'à 60 % du repos prévu.

La montée reste sous la barre des 45 minutes : si un cran fait déborder, il est
payé en récupération, et s'il ne rentre toujours pas il est refusé plutôt que
d'allonger la séance. Quand le matériel est saturé, l'app le dit au lieu de
faire monter un compteur qui ne change rien.

## Séance en cours

L'avancée est enregistrée au fur et à mesure, à chaque série validée, chaque
charge ajustée, chaque exercice passé. Rafraîchir la page, fermer l'onglet ou
laisser le téléphone tuer l'app ne coûte rien : la séance est retrouvée à la
même série, avec les séries déjà faites, et la récupération reprend son décompte
là où elle en était. Un rafraîchissement accidentel demande d'abord confirmation.

Le seul moyen de perdre une séance en cours est le bouton « Arrêter », en haut à
droite, qui propose d'abord de l'enregistrer puis fait confirmer l'abandon. Une
séance laissée en plan plus de douze heures est considérée comme abandonnée.

Cette séance reste sur l'appareil : elle n'est ni envoyée au serveur, ni
synchronisée avec l'autre appareil. Seule la séance terminée l'est.

## Données

Les séances vivent dans le `localStorage` du navigateur, clé `workout:data`.
Rien n'est commité dans le dépôt.

Pour effacer une séance : la balayer vers la gauche dans l'historique, puis
« Supprimer ». La date supprimée est retenue, sinon la copie de l'autre appareil
la ferait revenir à la synchronisation suivante.

## Sauvegarde en ligne et synchronisation (optionnelles)

Le dossier `sync/` contient un Worker Cloudflare qui sert de dépôt central. Sur
un seul appareil il tient lieu de sauvegarde ; sur deux, de synchronisation.

```bash
cd sync
npx wrangler kv namespace create seances   # reporter l'id dans wrangler.toml
npx wrangler secret put SYNC_KEY           # le jeton, pas la phrase : voir plus bas
npx wrangler deploy
```

L'état est chiffré dans le navigateur avant d'être envoyé : le serveur ne stocke
que des octets illisibles et ne détient rien qui permette de les relire. La
phrase saisie dans « Matériel » ne sort jamais de l'appareil ; on en dérive, par
deux sels différents, une clé AES-GCM qui reste locale et un jeton
d'authentification qui, lui, part sur le réseau. C'est ce jeton — affiché par le
bouton « Afficher le jeton » de l'écran « Matériel » — qu'il faut donner à
`wrangler secret put SYNC_KEY`.

Renseigner ensuite l'adresse du Worker et la phrase dans l'écran « Matériel », sur
chaque appareil. Ni l'une ni l'autre n'est commitée. Perdre la phrase, c'est
perdre la sauvegarde : personne, Cloudflare compris, ne peut la reconstituer.

L'application fusionne au lieu d'écraser : les séances des deux appareils sont
réunies par date, le reste (charges, matériel) vient du côté modifié en dernier.
Sans réseau, tout continue en local et repart à la synchronisation suivante.
L'export JSON reste disponible comme sauvegarde froide.

## Installer sur le téléphone

Ouvrir l'URL du site, puis « Ajouter à l'écran d'accueil ».
Le manifeste et le service worker en font une app plein écran qui fonctionne hors ligne.
