# StampForge

Static HTML/JS app for turning imported artwork into a 3D-printable matched embossing die set.

## Features

- Import raster artwork and convert it into a height mask.
- Preview the male die, female die, or matched pair.
- Presets for paper, thin sheet metal, and thicker press usage.
- Control relief depth, base thickness, edge clearance, forming gap, and edge softening.
- Export the visible die setup as an ASCII STL.

## GitHub Pages

This project has no build step. To deploy it:

1. Push `index.html`, `styles.css`, `app.js`, and this README to GitHub.
2. Open the repository settings on GitHub.
3. Go to Pages.
4. Set the source to the main branch and `/root`.
5. Save, then open the Pages URL once GitHub finishes publishing.

The app imports Three.js from a public CDN, so the deployed page needs normal internet access.
