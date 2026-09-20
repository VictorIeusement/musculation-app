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

## Habillage

Fond sombre, chiffres lumineux, un seul accent vert pour ce qui est actif ou
primaire. Le choix n'est pas décoratif : le téléphone se lit posé par terre ou
sur le banc, à un mètre, les mains moites. Tous les couples texte/fond tiennent
au-dessus du seuil de lisibilité et toutes les commandes font au moins 44 px.

La police est celle du système. La direction prévoyait Space Grotesk, mais une
police chargée depuis Google est une dépendance réseau, et l'app doit fonctionner
hors ligne.

## Accueil

L'écran d'accueil liste les exercices de la prochaine séance avec leurs
paramètres tels qu'ils seront proposés — séries, répétitions, charge ou durée,
récupération — niveau de difficulté compris.

La séance mise en avant suit le cycle A → B → C, sauf quand la semaine en cours
ne compte aucune séance : le programme est hebdomadaire, on repart alors de A
plutôt que de reprendre le cycle laissé en plan la semaine d'avant.

## Suivi du poids et de la composition corporelle

L'écran « Suivi » affiche l'évolution du poids, de la masse musculaire et de la
masse grasse, alimenté par un export de balance.

Sur le site de Withings : compte → télécharger mes données ; dans l'archive
reçue, c'est `weight.csv` qu'on importe. Les exports d'autres balances passent
aussi, tant que le fichier a une colonne de date et au moins une colonne de
mesure : les entêtes sont reconnues en français comme en anglais, le séparateur
est deviné, et les décimales à virgule sont acceptées. Réimporter le même
fichier ne duplique rien ; une mesure par jour est conservée, la plus tardive.

La plage est réglée sur trois mois par défaut : c'est la fenêtre où une
variation de poids veut dire quelque chose. « Tout » remonte aux pesées les plus
anciennes et écrase les dernières semaines contre le bord du cadre.

Quatre petits graphiques plutôt qu'un seul : les trois mesures n'ont pas le même
ordre de grandeur, et sur un axe commun les variations de poids — ce qu'on vient
regarder — seraient écrasées à plat. Un doigt glissé sur les courbes affiche les
valeurs d'une date ; le tableau en dessous donne les mêmes chiffres sans couleur.
Le quatrième cadre porte le volume d'entraînement par semaine, sur le même axe de
temps : c'est là que se lit le lien entre ce qu'on fait et ce que la balance
mesure. Une commande de plage (3 mois, 1 an, tout) régit l'ensemble de l'écran.

Sous les courbes, un tableau par périodes de quatre semaines met côte à côte les
séances faites, le volume soulevé et ce que les mesures ont bougé. C'est une mise
en regard, pas une preuve de cause à effet : ce qu'on mange et ce qu'on dort
pèsent plus lourd, et la composition corporelle répond en mois. L'app n'ajuste
jamais la difficulté d'après la balance ; elle affiche la tendance récente sur
l'écran de fin de séance, là où l'on décide de monter d'un niveau, et s'abstient
si la mesure de référence est trop ancienne pour que la comparaison ait un sens.

Une seule mesure par jour est retenue, la première : on se pèse le matin à jeun,
et une pesée du soir pèse un à deux kilos de plus.

Le réglage « début du suivi », en bas de l'écran, écarte les mesures antérieures
à une date. C'est ce qu'il faut quand la balance a changé de mode ou de profil :
les mesures d'avant ne sont pas comparables à celles d'après et fausseraient tous
les écarts. Elles ne sont pas effacées, seulement mises de côté — vider le champ
les reprend — et le réglage résiste au réimport du fichier complet.

Il n'y a pas de connexion automatique à Withings : leur API demande un secret
qui n'a pas sa place dans un dépôt public, et l'appel direct depuis un
navigateur est refusé. Il faudrait passer par le Worker de `sync/`.

## Balance connectée

Une fois la sauvegarde en ligne en place, l'écran Suivi propose de connecter
Withings. L'app relève alors les nouvelles pesées toute seule à chaque ouverture
de l'écran, au plus une fois toutes les six heures.

L'autorisation est détenue par le Worker, jamais par l'app : un secret client
n'a pas sa place dans un fichier publié sur GitHub Pages. Côté Cloudflare, il
faut deux secrets, `WITHINGS_ID` et `WITHINGS_SECRET`, et déclarer chez Withings
une URL de redirection qui pointe sur `<url-du-worker>/withings/callback`.

L'import de fichier reste disponible et donne les mêmes courbes : il sert de
recours si la liaison casse.

Seul le Worker sait si la liaison tient. L'app le note dans `balanceLiee` au
premier relevé et n'affiche alors plus « Connecter Withings » mais « Relever
maintenant » et « Oublier la liaison ». Tant que l'état est inconnu, le relevé
se refait au bout d'une minute plutôt que des six heures habituelles : sinon
l'écran proposerait pendant une demi-journée de connecter une balance déjà
connectée.

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

## Élastique, sans rien à accrocher

Aucun exercice ne suppose un point d'ancrage dans la pièce : c'est le corps qui
tend l'élastique. Il ne reste qu'un exercice à la bande, le tirage visage :
assis au sol, jambes tendues, la boucle passée autour des deux pieds, et le
tirage vers le front. Raccourcir la prise durcit l'exercice — c'est le réglage
de charge de l'élastique. Le schéma montre l'ancrage.

L'extension triceps s'y faisait aussi, pied arrière sur la bande et remontée
derrière le dos jusqu'à la nuque : ce montage demande près d'un mètre cinquante
d'élastique sous tension, ce qu'une boucle courte n'atteint pas. Elle se fait
maintenant à un haltère tenu à deux mains au-dessus de la tête. L'exercice y
gagne au passage d'être chargeable, donc de rentrer dans la progression au lieu
d'être un exercice muet.

## Barre olympique et haltères : deux inventaires

Les disques d'une barre olympique ont un alésage de 50 mm, ceux d'un haltère
28 : ils ne passent pas d'une barre à l'autre. L'écran « Matériel » tient donc
deux inventaires séparés, et les charges proposées ne se mélangent jamais.

Les disques de barre se comptent **par paire** : la barre se charge des deux
côtés à la fois. Ceux d'haltère se comptent **à la pièce**, parce que le nombre
d'haltères à charger dépend de l'exercice :

- **Deux haltères identiques** — curl, élévations, développé incliné, mollets,
  fente bulgare : un cran consomme quatre disques, un de chaque côté de chaque
  haltère.
- **Un seul haltère** (`uni:true`) — pullover, rowing unilatéral, extension
  triceps : un cran n'en consomme que deux, et tout le sac peut partir sur la
  même barre. Les charges montent donc deux fois plus haut.

`uni:true` sert aussi au volume : un haltère unique ne compte qu'une fois, pas
deux. L'oublier double silencieusement les kilos de l'exercice.

Aucune charge non composable n'est jamais proposée : `getW()` ramène toute
valeur sur la liste de l'exercice, qu'elle vienne d'un défaut de programme
arrondi ou d'un enregistrement fait avant que le sac ne change.

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

Le bouton « Trop dur », à côté, n'a volontairement pas la même portée. Une
séance se juge trop facile à la fin, dans son ensemble ; un exercice se révèle
trop lourd tout de suite, celui-là et pas les autres. « Trop dur » descend donc
l'exercice en cours d'un seul cran — les répétitions gagnées d'abord, la charge
ensuite, la récupération rognée en dernier recours — avec effet immédiat sur les
séries restantes, et la prochaine séance repart de là. Quand l'inventaire est
court au point qu'un cran de charge retirerait plus de 15 % du poids, c'est une
répétition qui part à la place : elle se dose.

Le bilan de fin de séance sait quels exercices ont été abaissés en cours de
route et ne les compte pas comme un manque — sinon la fonctionnalité punirait
celui qui s'en sert honnêtement.

## Minuteur

La feuille du minuteur se replie d'un appui sur son bandeau : elle passe d'une
demi-page à une barre basse qui garde le décompte, la progression et « Passer »,
et rend l'écran aux consignes de l'exercice. Le choix est retenu d'une
récupération à l'autre. Dans les deux états, la page réserve exactement la
hauteur de la feuille et le pied de séance se pose dessus : rien de ce qui est
affiché ne devient inatteignable, ni les consignes, ni « Série validée »,
« Trop dur » ou « Arrêter ».

Le décompte s'appuie sur un horodatage de fin, pas sur un compteur : il reste
juste si l'écran s'éteint ou si l'app passe en arrière-plan. L'alarme de fin est
une onde carrée doublée d'une octave, plus forte et plus longue qu'une
sinusoïde à volume égal, avec vibration ; elle se répète toutes les trois
secondes jusqu'à ce qu'on touche l'écran, au plus trois fois.

L'écran est tenu allumé pendant la séance. Le téléphone relâche ce verrou de
lui-même dès que l'app passe en arrière-plan : il faut donc le reprendre au
retour, et vérifier qu'il n'est pas simplement périmé — sans quoi l'écran
s'éteint pour tout le reste de la séance.

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

## Ce qui est enregistré, et ce qu'on en lit

Chaque série inscrit le **prévu** et le **réalisé** côte à côte : charge,
répétitions, durée, récupération réellement prise. L'objectif de référence est
figé au démarrage de la séance et recopié dans chaque ligne ; le relire plus
tard donnerait une comparaison qui change à chaque montée de niveau. Les
exercices au temps et l'échauffement sont inscrits eux aussi. S'y ajoutent les
événements de séance : cran monté ou descendu, exercice passé.

Sur un exercice au temps, la durée retenue est celle que le minuteur a
décomptée, pas le temps écoulé à l'horloge : celui-ci comptait aussi les
secondes qu'on met à faire taire l'alarme, et un gainage tenu tout juste
jusqu'au bout valait 113 %.

Le récapitulatif de fin compare les deux, exercice par exercice, et donne un
pourcentage d'atteinte — la moyenne des rapports par exercice, pas un total
mêlant des kilos et des secondes. Une ligne d'historique se touche pour revoir
ce bilan à tout moment.

L'écran Suivi porte, sous les mesures corporelles, une table de progression par
séance : les dates en colonnes, les exercices en lignes, et l'écart avec la fois
d'avant. L'écart se calcule sur un seul nombre à la fois — le volume là où il y
a une charge, le total de répétitions au poids du corps, les secondes tenues sur
un gainage. Pas de courbe : sur deux ou trois points, une ligne donnerait à une
variation l'allure d'une tendance.

### Charge réelle au poids du corps

Les pompes et les dips sur banc déplacent une partie du poids du corps, le reste
étant repris par les pieds au sol : le coefficient `part` de l'exercice, appliqué
au poids mesuré le jour de la séance, en donne une estimation. Les valeurs
retenues sont des moyennes de population — environ deux tiers aux pompes, un peu
moins de la moitié aux dips — et bougent avec la longueur des segments et la
position des pieds.

Ce chiffre est tenu **séparé** de la charge externe. Trois séries de pompes
pèsent près de 1 800 kg estimés, plus que toute la barre d'une séance : fondus
dans le même total, ils rendraient l'historique incomparable du jour au
lendemain et « kg soulevés » cesserait de vouloir dire ce qu'on a mis sur la
barre. Le calcul se fait à la lecture, pas à l'enregistrement : il vaut donc
aussi pour les séances déjà faites, et une pesée qui arrive après coup le
complète.

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
