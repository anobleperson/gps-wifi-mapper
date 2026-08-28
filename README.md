# Course WiFi Mapper

Offline WiFi signal survey and mapping tool for antenna range testing — built for testing the mANTBox coverage at Bradys Lake and the Forth River slalom courses.

## Publishing this with GitHub Pages

1. Create a new repository (or use an existing one) and add these files to the root: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`.
2. Push to GitHub.
3. In the repo, go to **Settings → Pages**, set "Build and deployment" source to **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://<username>.github.io/<repo>/` — that's the app.

## Using it in the field

1. Open the URL in Safari on your iPhone *once while you have signal* — this lets the service worker cache everything for offline use.
2. Share → Add to Home Screen for a proper app icon.
3. Before a test session with no signal expected, open the app again briefly if it's been more than a few days — iOS clears unused site caches after about a week, so a quick warm-up keeps it ready.
4. Everything from then on — logging, the map, CSV/KML export — works with zero connectivity.

## Updating the tool later

Edit `index.html` (bump `CACHE_NAME` in `sw.js` to e.g. `course-wifi-mapper-v2` so phones pick up the new version instead of serving the old cached one), commit, and push — GitHub Pages redeploys automatically within a minute or two.
