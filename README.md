# Salle à la maison

Application de suivi de séances de musculation à domicile : programme en 3 séances,
guidage exercice par exercice, minuteur avec alerte sonore, historique.

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

## Données

Les séances vivent dans le `localStorage` du navigateur, clé `workout:data`.
Rien n'est commité dans le dépôt.

## Synchronisation entre appareils (optionnelle)

Le dossier `sync/` contient un Worker Cloudflare qui sert de dépôt central.

```bash
cd sync
npx wrangler kv namespace create seances   # reporter l'id dans wrangler.toml
npx wrangler secret put SYNC_KEY           # une phrase longue, inventée
npx wrangler deploy
```

Renseigner ensuite l'adresse du Worker et la clé dans l'écran « Matériel »,
sur chaque appareil. La clé reste dans le navigateur, elle n'est jamais commitée.

L'application fusionne au lieu d'écraser : les séances des deux appareils sont
réunies par date, le reste (charges, matériel) vient du côté modifié en dernier.
Sans réseau, tout continue en local et repart à la synchronisation suivante.
L'export JSON reste disponible comme sauvegarde froide.

## Installer sur le téléphone

Ouvrir l'URL du site, puis « Ajouter à l'écran d'accueil ».
Le manifeste et le service worker en font une app plein écran qui fonctionne hors ligne.
