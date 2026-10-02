# TeslaCam Studio

Lecteur local pour les vidéos TeslaCam : événements Sentinelle, clips sauvegardés et clips récents. L'accueil présente le lecteur et permet de choisir le dossier TeslaCam. Après sélection, la bibliothèque regroupe les dates, lit les `event.json` et synchronise les caméras sur une timeline commune. La grille des clips affiche la caméra et l'instant représenté via une vidéo locale muette, en pause. Un événement s'ouvre à son horodatage ; les clips sans événement s'ouvrent au début. Trois dispositions sont disponibles après sélection d'un clip : vue avant avec rétroviseurs flottants (par défaut), mosaïque et caméra de l'événement en principal. Si le code de caméra de l'événement est inconnu ou si sa vidéo manque, la vue avant (ou une autre caméra disponible) est affichée. Le bouton **Tous les clips** ramène à la grille. Cliquez sur une caméra pour l'agrandir ; cliquez de nouveau ou appuyez sur `Échap` pour revenir à la disposition.

Raccourcis : `K` ou espace pour lire/mettre en pause, flèches gauche/droite pour reculer/avancer de 5 secondes, flèches haut/bas pour passer à l'enregistrement précédent/suivant, `Échap` pour quitter le focus caméra.

## Démarrer

Prérequis : Node.js 20.19+ (ou 22.12+) et npm.

```sh
npm install
npm run dev
```

Ouvrez l'adresse affichée par Vite, puis cliquez sur **Sélectionner le dossier TeslaCam** et choisissez `/Volumes/TESLADRIVE/TeslaCam` (ou votre propre dossier `TeslaCam`). Le dossier d'exemple ajouté au projet est `./TeslaCam` ; il est ignoré par Git avec les enregistrements qu'il contient. Un sous-dossier comme `SentryClips`, `RecentClips`, ou un dossier d'événement peut aussi être sélectionné. Le navigateur demande toujours cette autorisation : il ne peut pas accéder automatiquement à une clé USB. Il ne s'agit pas d'un envoi de fichiers : les vidéos sont lues directement depuis les `File` locaux via des URL temporaires, supprimées lors du changement de séquence.

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

## English

TeslaCam Studio is a local viewer for Tesla Sentry Mode, saved Dashcam, and recent recordings. It groups clips by date, reads `event.json`, and plays synchronized cameras on a shared timeline. The interface starts in French; choose **EN** in the header to switch to English. Your language and theme choices persist on this device.

### Get started

Requires Node.js 20.19+ (or 22.12+) and npm:

```sh
npm install
npm run dev
```

Open the URL shown by Vite. Connect your Tesla USB drive, click **Select the TeslaCam folder**, and choose its `TeslaCam` directory. You can also select `SentryClips`, `RecentClips`, or an individual event folder. The browser asks you to select the folder each time; it cannot access your drive without your permission. The sample `./TeslaCam` folder is ignored by Git.

Choose a clip in the library to open the player at its event time (or at the start when no event time is available). Switch between front-and-mirrors, grid, and event-camera layouts. Click a camera to enlarge it; click again or press `Escape` to return to the layout. Click **All clips** to return to the library. Use `K` or space to play/pause, left/right arrows to seek five seconds, and up/down arrows to change recordings.

Videos stay on your device: the app reads local `File` objects through temporary URLs. There is no upload, live camera access, or connection to your vehicle. Folder selection works best in Chromium browsers (Chrome, Edge) and Electron. Playback depends on your browser's MP4 codec support; unsupported cameras display an error.

### Web and macOS

```sh
npm run build        # build the static website in dist/
npm run preview      # preview the build locally
npm run desktop      # run the Electron app
npm run desktop:package # build the macOS app and DMG in release/
```

The static site can be hosted over HTTPS. Distributing the macOS app to other Macs may require Apple signing and notarization, which are not configured here. Electron uses the same local folder picker and does not expose a Node server to the page.

To verify changes, run `npm test`, `npm run lint`, and `npm run build`.