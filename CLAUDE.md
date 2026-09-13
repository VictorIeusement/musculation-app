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
2 bis. NIVEAU DE DIFFICULTÉ — `DATA.level` par séance, `DATA.reps`, `DATA.dur`,
   `DATA.rest` par exercice. `levelUp()` applique un cran (répétitions, puis
   charge, puis récupération) ; `raiseLevel()` est le seul point d'entrée : il
   tient le budget de 45 minutes et refuse un cran qui ne changerait rien.
3. SON, VIBRATION, VEILLE — `AudioContext` créé au premier geste utilisateur, `wakeLock`.
4. TIMER — décompte basé sur un horodatage de fin, pour rester juste après une mise en arrière-plan.
5. ÉTAT DE SÉANCE, 6. RENDU, 7. INTERACTIONS, 8. DÉMARRAGE.

## Contraintes à respecter
- Charges de barre : uniquement les combinaisons symétriques calculées par
  `buildLoads()` à partir de l'inventaire. Ne jamais proposer une charge non composable.
- Haltères : incrément minimal = 2 × le plus petit disque, un de chaque côté.
- Le minuteur doit rester exact si l'écran s'éteint ou si l'app passe en arrière-plan.
- Pas de dépendance externe : le fichier doit fonctionner hors ligne. Le
  chiffrement passe par `crypto.subtle`, natif au navigateur — rien à charger.
- `estimate()` doit rester sous 45 minutes à tous les niveaux de difficulté :
  c'est `raiseLevel()` qui en répond, et c'est ce qui justifie les plafonds
  `MAX_REPS`, `MAX_DUR` et le plancher de récupération.
- Ne jamais envoyer l'état en clair au serveur, ni écrire la phrase ailleurs que
  dans le `localStorage` de l'appareil.
