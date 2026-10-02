# TeslaCam Studio

Lecteur local pour les vidéos TeslaCam : événements Sentinelle, clips sauvegardés et clips récents. La bibliothèque regroupe les dates, lit les `event.json`, place les caméras autour de la vue avant et lit les séquences sur une timeline commune. Cliquez sur une caméra pour l'agrandir ; le bouton en haut du lecteur active le plein écran natif.

## Démarrer

Prérequis : Node.js 20.19+ (ou 22.12+) et npm.

```sh
npm install
npm run dev
```

Ouvrez l'adresse affichée par Vite, puis cliquez sur **Ouvrir un dossier** et choisissez `/Volumes/TESLADRIVE/TeslaCam` (ou votre propre dossier `TeslaCam`). Le dossier d'exemple ajouté au projet est `./TeslaCam` ; il est ignoré par Git avec les enregistrements qu'il contient. Un sous-dossier comme `SentryClips`, `RecentClips`, ou un dossier d'événement peut aussi être sélectionné. Le navigateur demande toujours cette autorisation : il ne peut pas accéder automatiquement à une clé USB. Il ne s'agit pas d'un envoi de fichiers : les vidéos sont lues directement depuis les `File` locaux via des URL temporaires, supprimées lors du changement de séquence.

Pour créer et prévisualiser la version web statique :

```sh
npm run build
npm run preview
```

Le contenu de `dist/` peut aussi être publié sur un hébergement statique HTTPS. La sélection d'un dossier local fonctionne surtout dans les navigateurs Chromium (Chrome, Edge) et dans Electron ; la prise en charge varie selon les navigateurs. Les vidéos sont décodées par le navigateur : si un codec MP4 n'est pas pris en charge, le lecteur l'indique sur la caméra concernée.

## Application macOS

```sh
npm run desktop
```

Pour produire une application macOS et un DMG dans `release/` :

```sh
npm run desktop:package
```

La distribution à d'autres Mac nécessite éventuellement une signature et une notarisation Apple, non configurées ici. L'application utilise le même sélecteur de dossier local que le site ; aucun serveur ni accès Node n'est exposé à la page.

## Vérification

```sh
npm test
npm run lint
npm run build
```