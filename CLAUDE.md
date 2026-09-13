# Contexte pour Claude Code

## Nature du projet
Site statique d'une seule page. Pas de framework, pas de bundler, pas de
`package.json`, pas de tests. Ouvrir `index.html` dans un navigateur suffit à
tester. Le déploiement est un `git push` sur `main` (GitHub Pages).

## Fichiers
- `index.html` — toute l'application : styles, données du programme, logique.
- `sw.js` — service worker, stratégie réseau d'abord avec repli sur le cache.
  Le nom du cache (`CACHE`) est à incrémenter si le cache doit être purgé de force.
- `manifest.webmanifest`, `icone-*.png` — installation sur l'écran d'accueil.
- `sync/worker.js`, `sync/wrangler.toml` — Worker Cloudflare + KV, déployé
  séparément avec `npx wrangler deploy`. Le secret Wrangler `SYNC_KEY` est le
  jeton dérivé de la phrase, jamais la phrase elle-même, jamais une valeur du
  dépôt. `ALLOWED_ORIGIN` doit correspondre à l'origine du site (sans le
  sous-dossier). Le Worker ne voit passer que des enveloppes chiffrées : il ne
  les inspecte pas, il vérifie seulement que c'est du JSON.

## Organisation de `index.html`
Le `<script>` principal est découpé en sections numérotées en commentaires :
1. PROGRAMME — constante `PROGRAM` : 3 séances, chacune avec ses exercices
   (`n`, `type` reps ou time, `sets`, `reps`/`dur`, `rest`, `load`, `def`, `side`, `cues`).
   `estimate()` calcule la durée d'une séance : elle doit rester sous 45 minutes.
1 bis. FIGURES — `FIG` : une illustration par exercice, dessinée en SVG dans la
   page, repère 120×80, sol à y=72. Pictogramme réglé sur environ huit têtes,
   épaisseurs hiérarchisées (cuisse 5, mollet 4, bras 3,6, avant-bras 3) et
   tronc plein : des membres d'égale largeur et une tête ronde surdimensionnée
   ne donnent qu'un pantin enfantin. Le membre passant devant le corps est
   d'abord tracé à la couleur de la surface, plus large — sans ce liseré il se
   fond dans le tronc sur les mouvements penchés.
   **Vue de profil, sauf mention `v:"face"`.** Conséquence à ne pas oublier :
   une barre dont l'axe traverse les épaules s'y voit PAR LA TRANCHE, donc en
   disque (`disque()`), jamais en trait horizontal (`barreFace()`, réservé aux
   figures dessinées de face) — sinon on ne sait plus si la barre est parallèle
   aux épaules ou dans l'axe du corps. `figureDe()` rend le SVG et annonce la
   vue aux lecteurs d'écran, `videoDe()` fabrique le lien de recherche vidéo.
2. DONNÉES — `localStorage` (clé `workout:data`), export/import JSON, et
   sauvegarde chiffrée : `localSave()` écrit en local, `save()` ajoute
   l'horodatage et déclenche `syncNow()`, `merge()` réunit deux états sans rien
   perdre. `DATA.sync` (adresse + phrase) ne doit jamais être poussé au serveur
   ni commité. `derive()` tire de la phrase, par deux sels distincts, un jeton
   d'authentification et une clé AES-GCM ; `seal()`/`unseal()` encadrent l'état.
   Une phrase qui ne déchiffre pas interrompt la synchronisation **avant** le
   PUT : sinon on écraserait une sauvegarde encore bonne.
   Les séances supprimées laissent leur date dans `DATA.deleted`, que `merge()`
   respecte — sans quoi la copie du serveur les ferait revenir.
2 ter. COMPOSITION CORPORELLE — `DATA.body`, une mesure par jour importée d'un
   export de balance. `lireCSV()` devine le séparateur sur la ligne d'entête et
   lui seul découpe (un export français sépare en `;` et écrit ses décimales en
   `,`) ; `lireBalance()` reconnaît les colonnes par mots-clés, français comme
   anglais, et lève un message explicite plutôt que d'inventer. `fusionCorps()`
   déduplique par jour en gardant la PREMIÈRE pesée — celle du matin à jeun ;
   une pesée du soir pèse un à deux kilos de plus et ferait remonter la courbe
   pour rien. Withings nomme sa colonne « Gras (kg) », pas « Masse grasse » :
   toute nouvelle marque de balance demande d'élargir `COLONNES`.
   `DATA.bodyFrom` écarte les mesures antérieures à une date sans les effacer :
   une balance qui change de mode ou de profil produit une rupture, et ce qui
   précède n'est pas comparable. Toute lecture des mesures passe par
   `mesuresRetenues()`, jamais par `DATA.body` directement.
   `periodes()` et `tendance()` mettent l'entraînement en regard des mesures
   sans jamais affirmer de causalité, et se taisent quand la mesure de référence
   est bien plus ancienne que la fenêtre demandée.
2 bis. NIVEAU DE DIFFICULTÉ — `DATA.level` par séance, `DATA.reps`, `DATA.dur`,
   `DATA.rest` par exercice. `levelUp()` applique un cran (répétitions, puis
   charge, puis récupération) ; `raiseLevel()` est le seul point d'entrée : il
   tient le budget de 45 minutes et refuse un cran qui ne changerait rien.
3. SON, VIBRATION, VEILLE — `AudioContext` créé au premier geste utilisateur, `wakeLock`.
4. TIMER — décompte basé sur un horodatage de fin, pour rester juste après une
   mise en arrière-plan. `stop()` exécute la suite du minuteur, `cancel()` le
   referme sans l'exécuter : quitter ou sauter un exercice pendant une
   récupération passe par `cancel()`, sinon la séance avancerait au passage.
5. ÉTAT DE SÉANCE — `S` en mémoire, recopié dans `DATA.cur` à chaque changement
   par `saveCur()` (appelé depuis `render()`), relu au démarrage par
   `reprendre()`. La séance en cours reste locale : exclue du PUT, conservée
   telle quelle par `merge()`. `validateSet()` fait avancer la séance **une
   seule fois** ; la récupération ne fait que s'afficher par-dessus et sa fin ne
   rejoue pas l'avancement.
6. RENDU, 7. INTERACTIONS, 8. DÉMARRAGE.
   Écran « Suivi » : `courbes()` trace trois petits graphiques superposés plutôt
   qu'un axe commun — poids, masse musculaire et masse grasse n'ont pas le même
   ordre de grandeur, et un axe partagé écraserait les variations de poids. Un
   tracé par cadre, donc pas de légende : le titre nomme la série. Les trois
   teintes de `SERIES` sont validées pour les daltonismes ET pour le
   contraste sur la surface sombre — la palette d'origine, réglée pour un fond
   clair, y tombait à 2,4:1. Ne pas les changer sans revalider les six contrôles. Le tableau sous les courbes est la version lisible sans
   couleur, et il ne doit pas disparaître. Le quatrième cadre porte le volume
   d'entraînement sur le même axe de temps : c'est là que se lit le lien avec
   les courbes, et c'est volontairement une mise en regard, pas un coefficient —
   sur si peu de points il serait faussement précis. `borneBasse()` ancre la
   plage sur l'événement le plus récent, mesure ou séance, et l'axe couvre les
   deux sources, sinon les barres déborderaient du cadre.
   Côté accueil : `nextSession()` choisit la séance mise en avant — le cycle
   `DATA.nextIdx`, sauf si la semaine en cours est vide, auquel cas on repart de
   A. `paramsOf()` rend les paramètres réels d'un exercice (séries, répétitions,
   charge ou durée, récup), niveau de difficulté compris.

## Habillage
Direction « cockpit » : fond sombre, chiffres lumineux, un seul accent
(`--signal`) pour ce qui est actif ou primaire. Tout passe par les variables de
`:root` — `--concrete` le fond, `--surface` les cartes et feuilles, `--ink` le
texte, `--steel` le secondaire, `--hot` l'alerte. Ne jamais écrire une couleur
en dur dans un composant : c'est ce qui avait laissé des rgba() clairs traîner
au changement de direction.
La police reste la pile système : la direction prévoyait Space Grotesk, mais une
police Google est une dépendance réseau, et le fichier doit fonctionner hors
ligne.

## Contraintes à respecter
- Aucun exercice à l'élastique ne doit supposer un point d'ancrage fixe dans la
  pièce : l'utilisateur n'en a pas. L'ancrage est le pied ou la main libre, et
  il doit se voir sur le schéma. Le réglage de charge est la longueur utile —
  reculer le pied, écarter les pieds.
- Charges de barre : uniquement les combinaisons symétriques calculées par
  `buildLoads()` à partir de l'inventaire. Ne jamais proposer une charge non composable.
- Haltères : incrément minimal = 2 × le plus petit disque, un de chaque côté.
- Le minuteur doit rester exact si l'écran s'éteint ou si l'app passe en arrière-plan.
- Pas de dépendance externe : le fichier doit fonctionner hors ligne. Le
  chiffrement passe par `crypto.subtle`, natif au navigateur — rien à charger,
  et les illustrations sont du SVG écrit dans la page, pas des images à aller
  chercher. Le lien vidéo est le seul élément qui demande le réseau : il pointe
  sur une recherche, jamais sur une vidéo précise, qui finirait par disparaître.
- Tout exercice ajouté à `PROGRAM` doit recevoir sa figure dans `FIG`, sous le
  même nom : c'est la clé qui les relie.
- `estimate()` doit rester sous 45 minutes à tous les niveaux de difficulté :
  c'est `raiseLevel()` qui en répond, et c'est ce qui justifie les plafonds
  `MAX_REPS`, `MAX_DUR` et le plancher de récupération.
- Tout couple texte/fond doit tenir 4,5:1 (3:1 pour le gros texte), et toute
  commande tactile 44 px de haut — par du remplissage, pas en grossissant la
  typographie. Le test du navigateur parcourt chaque écran et le vérifie.
- Ne jamais envoyer l'état en clair au serveur, ni écrire la phrase ailleurs que
  dans le `localStorage` de l'appareil.
- Jamais de second axe vertical sur un même graphique : deux échelles côte à
  côte inventent une corrélation. Deux mesures d'ordres différents, deux cadres.
- Une séance en cours ne se perd que par « Arrêter », et seulement après deux
  confirmations. Ni un rafraîchissement, ni un onglet fermé, ni l'app tuée par
  le téléphone ne doivent coûter quoi que ce soit.
