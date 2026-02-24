
# Geography Trainer v1.8 (Option 1 + Embedded Fallbacks)

- SVG flags: `/svg/<lowercase ISO>.svg` when `Lookup === "SWITCHED_TO_SVG"`.
- Embedded fallbacks: **use Column E** path (e.g., `files/flags/row-XXX.png`) for all other rows.
- Runtime caching: service worker caches `/svg/*.svg` and `/files/flags/*.{png,jpg,webp,avif,gif}`.
- Landing screen (index.html) routes to modes; `quiz.html` runs the game; `leaderboards.html` shows Top‑5 per mode.

## What you need on GitHub
- Keep your `/svg/` folder at repo root (as you already have).
- Upload only the **embedded PNGs/JPGs referenced in Column E** that are listed in `needed_embedded.txt` to their exact paths (usually `files/flags/…`).

## Files in this drop
- index.html, quiz.html, leaderboards.html
- app_v1.8.js, data_v1.8.js
- service-worker.js, manifest.webmanifest, icons
- needed_svgs.txt, needed_embedded.txt (checklists from the Excel)

## Deploy
1) Upload these files to your repo root (keep `/svg/` as-is).
2) Add the PNGs/JPGs listed in `needed_embedded.txt` to `files/flags/`.
3) Ensure GitHub Pages publishes from the folder containing `index.html`.
4) Visit the site → pick a mode.

## Notes
- Flag-based modes only include rows where a `flag` URL is present (either SVG or Column E path).
- Text modes include **all** rows regardless of flag availability.
