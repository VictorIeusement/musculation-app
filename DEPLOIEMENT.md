# Marche à suivre pour le déploiement

Document destiné à Claude Code. Exécuter les étapes dans l'ordre, en s'arrêtant
à chaque case marquée « intervention humaine » pour demander à l'utilisateur.

Contexte : site statique à publier sur GitHub Pages, plus un Worker Cloudflare
optionnel dans `sync/` pour synchroniser les données entre téléphone et ordinateur.
Compte GitHub associé à l'adresse vic.delaunay@gmail.com.

## Étape 0 — vérifier l'outillage

```bash
git --version
gh --version        # GitHub CLI ; si absent, proposer l'installation
npx wrangler --version
```

Si `gh` manque, l'installer selon la plateforme (Homebrew, winget, apt).
Si `npx` manque, Node.js n'est pas installé : le signaler et s'arrêter là pour
la partie synchronisation, le déploiement GitHub reste possible autrement.

## Étape 1 — dépôt local

```bash
git init -b main
git config user.email "vic.delaunay@gmail.com"
git add .
git commit -m "Application de suivi des séances"
```

## Étape 2 — GitHub (intervention humaine)

```bash
gh auth status || gh auth login
```

`gh auth login` ouvre un navigateur et demande un code : laisser l'utilisateur
faire, ne pas tenter de contourner. Ensuite :

```bash
gh repo create seances --public --source=. --push
```

Demander d'abord confirmation du nom du dépôt et du caractère public.
Public est le choix par défaut ici : aucune donnée personnelle n'est dans le
dépôt, et GitHub Pages depuis un dépôt privé demande un plan payant.

## Étape 3 — activer Pages

Tenter :

```bash
gh api -X POST repos/{owner}/seances/pages -f "source[branch]=main" -f "source[path]=/"
```

Si l'appel échoue (droits, syntaxe, API modifiée), ne pas insister : indiquer à
l'utilisateur le chemin manuel, Settings → Pages → Deploy from a branch → `main`
→ `/ (root)`, et attendre sa confirmation avant de continuer.

Récupérer ensuite l'URL publiée :

```bash
gh api repos/{owner}/seances/pages --jq .html_url
```

Vérifier que l'URL répond (`curl -I`) avant de déclarer l'étape réussie. Le
premier déploiement prend parfois une à deux minutes.

## Étape 4 — synchronisation (optionnelle)

Demander à l'utilisateur s'il la veut maintenant. Si oui :

1. `cd sync && npx wrangler login` — ouvre un navigateur, **intervention humaine**.
2. `npx wrangler kv namespace create seances` puis reporter l'`id` renvoyé dans
   `wrangler.toml`, à la place de `A_REMPLACER`.
3. Dans `wrangler.toml`, remplacer `ALLOWED_ORIGIN` par l'URL exacte trouvée à
   l'étape 3, sans barre oblique finale (exemple `https://vic.github.io`).
   Cette valeur doit être l'origine seule, pas l'URL complète du sous-dossier.
4. `npx wrangler secret put SYNC_KEY` — **intervention humaine**. Attention :
   ce n'est pas la phrase de l'utilisateur qui se pose ici, mais le jeton
   qu'elle produit. L'utilisateur saisit d'abord sa phrase dans l'écran
   « Matériel » de l'app, appuie sur « Afficher le jeton », et c'est ce jeton
   qu'il colle dans wrangler. La phrase elle-même ne quitte jamais son
   navigateur : elle sert aussi de clé de chiffrement, et le serveur ne doit
   pas la connaître. Ne jamais en inventer une à sa place, ne jamais écrire
   l'une ou l'autre dans un fichier du dépôt.
5. `npx wrangler deploy` puis noter l'URL du Worker.
6. Vérifier que le Worker refuse bien une requête sans jeton :
   `curl -i <url-du-worker>` doit répondre 401.
7. `cd .. && git commit -am "Configuration du Worker" && git push`

## Étape 5 — restitution

Afficher à l'utilisateur :

- l'URL du site, à ouvrir sur le téléphone puis « Ajouter à l'écran d'accueil » ;
- l'URL du Worker, à saisir avec sa phrase dans l'écran « Matériel », sur chaque appareil ;
- le rappel que la phrase n'est stockée que dans le navigateur, jamais dans le dépôt,
  et qu'elle est irrécupérable : la perdre, c'est perdre la sauvegarde, puisque
  le serveur ne détient que des données chiffrées.

## À ne pas faire

- Ne pas commiter de clé, de jeton ou de secret.
- Ne pas rendre le dépôt privé sans prévenir que Pages cesserait de publier
  sur un plan gratuit.
- Ne pas modifier `index.html` pendant le déploiement : c'est un sujet séparé.
