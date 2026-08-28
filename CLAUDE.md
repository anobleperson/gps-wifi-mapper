# Course WiFi Mapper — project context for Claude Code

Read this before making changes — it captures decisions and dead ends that
aren't obvious from the code alone.

## What this is

An offline WiFi signal-strength survey tool for iPhone, for testing the coverage
of a fixed antenna over an outdoor sports course where **no internet is available
at any point** — a remote setting with zero connectivity expected on test days.
The radio under test is a MikroTik mANTBox 2 12s (2.4 GHz sector) on a mast,
covering the course so on-site devices can reach local scoring software.

The tool: walk (or paddle) the course, log a WiFi reading + GPS position at each
spot, then review the readings as a colour-coded map afterwards. Works fully
offline.

## Why this isn't a simple "read WiFi signal, done" app

**iOS gives no public API for a third-party app (native or web) to read raw WiFi
RSSI.** This was verified via web research (not assumption) — see Sources below.
The one legitimate way to get exact dBm on iPhone is the built-in **Shortcuts
app's "Get Network Details" action** (iOS 17+, no jailbreak/entitlement needed):
it returns RSSI, Noise, Channel, SSID/BSSID, Rx/Tx rate as a one-shot snapshot
per run — you re-run it manually each time, it doesn't live-update.

Off-the-shelf apps were evaluated and rejected:
- **WiFi Heatmap & Speed Survey** (iOS) — uses the same Shortcuts trick under the
  hood, so no advantage; reviews report the automatic scan being unreliable.
- **NetSpot** (iOS) — indoor floor-plan surveys only, capped free tier, no
  GPS/outdoor mode.
- **WalkTest** (iOS) — genuinely GPS/outdoor-capable, but its "WiFi signal"
  metric is actually download/upload speed + latency, not real RSSI; needs Google
  Maps tiles (i.e. a connection); priced as enterprise software
  ($99.99–$399.99/**month**).
- **Windows/Linux** don't have iOS's restriction — `iw dev <iface> link` (Linux)
  or **WifiInfoView** (Windows, NirSoft, free/portable, has a `/scomma`
  CSV-export flag) give real dBm natively via the OS. `netsh wlan show
  interfaces` on Windows only gives a signal *percentage* on ordinary builds, not
  dBm — don't rely on it. Not pursued further because laptop field logistics
  (GPS, power) weren't settled; the simplest path is typing a laptop-read dBm
  number into this same tool.

So: this tool doesn't try to read RSSI itself. It takes a number the user already
obtained (via the Shortcut, or read off a laptop), a subjective 1–5 rating, or a
dead-zone marker — all tied to a GPS fix taken at the same moment.

## Architecture

Single-page app (`index.html`), vanilla JS, no frameworks, no external
dependencies (no CDN calls of any kind — everything must work with literally zero
network access in the field).

**Four tabs:**
- **Setup** — instructions for building the one-time "WiFi Point" Shortcut (Get
  Current Location + Get Network Details + a Calculate action for SNR + **Append
  to Text File** to add a CSV row). Written as user-facing prose since a valid
  signed `.shortcut` file can't be generated outside the Shortcuts app itself.
  Not yet built and field-tested on a real iPhone — see Open Items.
- **Log** — manual point logging in-app: GPS fix button, then one of three rating
  modes (1–5 stars, exact dBm + optional noise → auto-computed SNR, or a "dead
  zone" marker), plus a free-text note. Session list with per-point delete.
- **Import** — file picker for the CSV the Shortcut produces. Tolerant CSV parser
  (quoted-field aware, header-name matched so column order/extras don't matter).
- **Map** — plots all points either on an uploaded course photo (tap two points,
  enter their real lat/lon, and a 2-point similarity transform — scale + rotation
  + translation solved from the two correspondences — maps every GPS point onto
  image pixel space) or a plain north-up grid (local equirectangular projection
  centred on the first point, auto-scaled with a scale bar). Tap a pin for
  detail. Exports CSV, PNG (canvas.toBlob), and **KML** (colour-coded
  Placemarks, opens directly in Google Earth or imports at mymaps.google.com —
  the everyday Google Maps app can't open KML/CSV itself). Also has "Copy CSV
  text"/"Copy KML text" clipboard buttons as a fallback in case a viewer's
  download links don't fire.

**Colour tiers live in one place** — the `TIERS` object and `tierFor(p)`
function — used by both the canvas map dots and the KML style blocks. If you
change the SNR/RSSI thresholds, that's the only place to edit. Currently: SNR
≥25 dB excellent, ≥15 good, ≥10 marginal, else poor (RSSI thresholds as fallback
when noise isn't known: ≥-60 excellent, ≥-70 good, ≥-80 marginal, else poor); a
1–5 manual rating maps onto the same five tiers.

**Expected CSV columns** (header-name matched, order-independent):
`timestamp,lat,lon,accuracy,ssid,rssi,noise,snr,channel,note`. If you change
this, update both the Shortcut-building instructions in the Setup tab and the
`parseCsv`/export-header code together — they're only kept in sync by hand. Note
the Shortcut path leaves `accuracy` blank (the Location action no longer exposes
horizontal accuracy); the Log tab still records it for hand-entered readings.

**State**: an in-memory `points` array, mirrored to `localStorage` as
best-effort (not a durable record), each
`{id, ts, lat, lon, acc, ssid, rssi, noise, snr, quality, dead, note}`.

## The distribution saga — why this is a GitHub Pages PWA, not just a file

Three iterations, worth knowing so you don't re-suggest an already-dead-ended
approach:

1. **Plain HTML file, AirDropped/saved to Files, opened via Safari's "Open in
   Safari" from the share sheet, Add to Home Screen.** The "classic" way to
   sideload a single-file web app on iOS; shipped first.
2. **Broke**: as of iOS 18.5+, Apple removed "Open in Safari" from the Files app
   share sheet for local files entirely (confirmed via an Apple Community
   moderator reply and a developer forum thread describing the same regression
   starting iOS 16). Quick Look previews HTML but does not execute JavaScript.
   Worked around with a free third-party viewer (`ios-html-viewer.netlify.app`,
   open source — loads the local file into an iframe from within a normally
   hosted https page, sidestepping the block) or a paid one (HTMLViewer Pro+,
   $2.99). Added the clipboard-copy fallback buttons here because it was
   unconfirmed whether Blob downloads work inside third-party viewers.
3. **Current approach: host it on GitHub Pages.** Sidesteps the local-file
   restriction entirely (normal https page), restores normal `<a download>`
   behaviour, and — with `manifest.json` + `sw.js` — genuinely works offline
   after the first visit. Verified end-to-end with Playwright: served over a
   local static HTTP server, let the service worker cache the app shell on first
   load, then set the browser context fully offline and reloaded — it still
   rendered, `localStorage` data survived, and a new point could be logged with
   zero network access.

**Known limitation, not yet worked around**: Safari's Intelligent Tracking
Prevention evicts an unvisited origin's cache (service worker cache included)
after roughly a week of no interaction. WebKit's storage-policy documentation
describes Home-Screen-installed PWAs as sharing the same quota/eviction rules as
a normal Safari tab — no special exemption. Given this is used for seasonal test
sessions weeks apart, this is a real risk. Current mitigation is user habit
("open it briefly the night before if it's been a while"). A proper fix (a
periodic background-sync trick, or an in-app "last verified online" timestamp)
is an open opportunity — nothing has been attempted.

## File inventory

- `index.html` — the app. Has `<link rel="manifest">`, `apple-mobile-web-app-*`
  meta tags, an `#offlineStatus` indicator in the header that reports cache
  readiness, and a service-worker registration block near the end of the script.
- `manifest.json` — standard web app manifest, `display: standalone`, theme
  colour `#1f6f4f`.
- `sw.js` — cache-first service worker. **Bump `CACHE_NAME` on every release**
  (currently `course-wifi-mapper-v2`), or returning phones keep serving the
  stale cached version. Caches `./`, `./index.html`, `./manifest.json`, and both
  icons on install; on activate, deletes any cache whose name doesn't match
  `CACHE_NAME`.
- `icon-192.png`, `icon-512.png` — generated wifi-mark icons, green `#1f6f4f` on
  white.
- `README.md` — GitHub Pages publish steps (Settings → Pages → Deploy from
  branch → `main` → `/root`) and field-use notes.

## What's been verified vs. what's untested

**Verified** (via Playwright against headless Chromium, both as a local `file://`
page and served over a local HTTP server):
- All three logging modes (1–5 rating, exact dBm + noise → SNR, dead zone) add
  points correctly.
- CSV import (tolerant parser) and CSV/KML export produce correct, well-formed
  output — KML checked with `DOMParser` for XML validity, not just eyeballed.
- The 2-point photo calibration transform computes without error and places pins
  sensibly.
- Clipboard copy fallback works.
- **Full offline reload after service-worker caching**: cache populates on first
  (online) load, and a subsequent fully-offline reload still renders the app,
  keeps `localStorage` state, and accepts new points.

**Never actually tested / built by a human yet:**
- The Shortcuts "WiFi Point" recipe in the Setup tab — written from documented
  Shortcuts action names, but nobody has built it on a real iPhone and confirmed
  the CSV it produces matches what `parseCsv` expects. Highest-value thing to
  validate first.
- GitHub Pages hosting itself — the offline test used a local Python HTTP server
  standing in for it. Should behave identically (both plain static file servers
  over https), but not confirmed against the actual `github.io` domain.
- Real-world GPS accuracy / cold-start time at the actual outdoor sites — the
  in-app warning about first-fix taking ~30–60 s outdoors with no cell/data is
  general knowledge, not measured on-site.
- Whether the KML/CSV opens cleanly in Google Earth / Google My Maps on a real
  device — validated as well-formed XML with correct lat/lon ordering, but never
  round-tripped through the actual Google apps.

## Immediate next steps

1. Enable GitHub Pages (Settings → Pages → Deploy from branch → `main` →
   `/root`).
2. Open the resulting `https://<user>.github.io/<repo>/` URL in Safari on the
   iPhone, confirm the `#offlineStatus` indicator reports "✓ Cached for offline
   use", Add to Home Screen.
3. Build the Shortcuts "WiFi Point" recipe from the Setup tab and confirm its CSV
   output imports cleanly — the least-verified part of the whole system.
4. Field-test on-site if possible, or at minimum airplane-mode-test at home to
   confirm the offline behaviour holds outside a Playwright setup.

## Field conditions the design assumes

Remote outdoor sites with no cell service: expect long cold GPS fixes, foliage
attenuation, and legs of roughly 100–300 m from the antenna. The antenna is a
MikroTik mANTBox 2 12s (2.4 GHz, 2-chain, integrated 12 dBi 120° dual-pol
sector, replacing an earlier omni design that went EOL). This is why the tool
tolerates missing GPS accuracy, warns about first-fix time, and never assumes a
connection.

## Sources consulted (for the RSSI-access and iOS-lockdown claims above)

- https://www.intuitibits.com/2023/09/21/yet-another-wi-fi-details-shortcut-for-ios/
- https://matthewcassinelli.com/shortcuts/get-network-details/
- https://wlanprofessionals.com/the-2026-field-guide-to-ios-wi-fi-tools/
- https://discussions.apple.com/thread/256102223
- https://developer.apple.com/forums/thread/735383
- https://hackernoon.com/ioss-local-html-preview-woes-solved-open-source-ad-free
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- https://www.nirsoft.net/utils/wifi_information_view.html
