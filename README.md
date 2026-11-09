# AEDS Stage 1 UI v2 (static export)

Interactive UI screens exported from the design canvas. Open `index.html` for the list of screens.

## Deploy to GitHub Pages
1. Create a repository on GitHub (for example `aeds-stage1-ui`).
2. Upload every file in this folder to the root of the `main` branch (keep `.nojekyll`).
3. In the repository: Settings > Pages > Build and deployment > Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`, Save.
4. After about a minute the site is at `https://<your-account>.github.io/<repository>/`.

## Files
- `index.html`: list of all screens
- `*.dc.html`: one page per screen
- `ds.css`: shared styles
- `dc-lite.js`: small renderer for the screens' markup and logic
- `react-vendor.js`: React 19 (MIT licence, Meta Platforms, Inc.)

Pages must be served over http(s); opening the files directly from disk also works in most browsers.
