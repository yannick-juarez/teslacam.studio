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