# Collage PDF

A small React app that arranges uploaded images into a print-ready grid and
exports a sharp PDF. Each image keeps its **original aspect ratio** (it's fit
inside its cell, never stretched or cropped) so you can cut it out cleanly
after printing.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

## How to use

1. Click the dropzone (or drag images onto it) to add photos.
2. Adjust the grid — default is **3 columns × 4 rows = 12 per page**. Page size,
   orientation, margins, gap and cut lines are all adjustable.
3. Drag thumbnails to reorder; hover a thumbnail and click **×** to remove it.
4. Click **Download PDF**. More than 12 images automatically spill onto extra
   pages.

## Why it stays sharp

The PDF is **not** a screenshot of the preview. Each image's original pixels are
re-rendered at the chosen DPI (300 by default) for the exact printed size, with
EXIF rotation applied and transparency flattened onto white. The on-screen
preview just mirrors the same layout math.

## Build

```bash
npm run build      # outputs to dist/
npm run preview
```
