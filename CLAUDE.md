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
  séparément avec `npx wrangler deploy`. La clé partagée est un secret Wrangler,
  jamais une valeur du dépôt. `ALLOWED_ORIGIN` doit correspondre à l'URL du site.

## Organisation de `index.html`
Le `<script>` principal est découpé en sections numérotées en commentaires :
1. PROGRAMME — constante `PROGRAM` : 3 séances, chacune avec ses exercices
   (`n`, `type` reps ou time, `sets`, `reps`/`dur`, `rest`, `load`, `def`, `side`, `cues`).
   `estimate()` calcule la durée d'une séance : elle doit rester sous 45 minutes.
2. DONNÉES — `localStorage` (clé `workout:data`), export/import JSON, et
   synchronisation : `localSave()` écrit en local, `save()` ajoute l'horodatage
   et déclenche `syncNow()`, `merge()` réunit deux états sans rien perdre.
   `DATA.sync` (adresse + clé du Worker) ne doit jamais être poussé au serveur
   ni commité.
3. SON, VIBRATION, VEILLE — `AudioContext` créé au premier geste utilisateur, `wakeLock`.
4. TIMER — décompte basé sur un horodatage de fin, pour rester juste après une mise en arrière-plan.
5. ÉTAT DE SÉANCE, 6. RENDU, 7. INTERACTIONS, 8. DÉMARRAGE.

## Contraintes à respecter
- Charges de barre : uniquement les combinaisons symétriques calculées par
  `buildLoads()` à partir de l'inventaire. Ne jamais proposer une charge non composable.
- Haltères : incrément minimal = 2 × le plus petit disque, un de chaque côté.
- Le minuteur doit rester exact si l'écran s'éteint ou si l'app passe en arrière-plan.
- Pas de dépendance externe : le fichier doit fonctionner hors ligne.
