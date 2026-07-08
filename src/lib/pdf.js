import { jsPDF } from 'jspdf'

const MM_PER_INCH = 25.4

// Page sizes in mm [width, height] in portrait.
const PAGE_SIZES = {
  a4: [210, 297],
  letter: [215.9, 279.4],
}

/**
 * Decode a File into an ImageBitmap, honoring EXIF orientation so that
 * photos taken on phones are not rotated sideways.
 */
async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older engines may not support the option object.
    return await createImageBitmap(file)
  }
}

/**
 * Render a bitmap into a JPEG data URL at a resolution targeted to `dpi`
 * for the given printed size (mm). We never upscale beyond the source,
 * so large photos stay sharp and small ones don't bloat the file.
 * Transparent areas are flattened onto white.
 */
function rasterize(bitmap, boxWmm, boxHmm, dpi, quality, fitMode) {
  // Source crop: 'cover' crops the image to the box aspect ratio; 'contain'
  // (the default) uses the whole image untouched.
  let sx = 0
  let sy = 0
  let sW = bitmap.width
  let sH = bitmap.height
  if (fitMode === 'cover') {
    const boxAspect = boxWmm / boxHmm
    sH = bitmap.width / boxAspect
    if (sH > bitmap.height) {
      sH = bitmap.height
      sW = bitmap.height * boxAspect
    }
    sx = (bitmap.width - sW) / 2
    sy = (bitmap.height - sH) / 2
  }

  // Output resolution targeted to `dpi` for the printed box, never upscaling.
  const targetWpx = (boxWmm / MM_PER_INCH) * dpi
  const scale = Math.min(1, targetWpx / sW)
  const w = Math.max(1, Math.round(sW * scale))
  const h = Math.max(1, Math.round(sH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, sx, sy, sW, sH, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Build the collage PDF.
 * @param {Array<{file: File}>} items
 * @param {object} opts page/layout options
 * @returns {jsPDF}
 */
export async function generatePdf(items, opts) {
  const {
    pageFormat = 'a4',
    orientation = 'portrait',
    cols = 3,
    rows = 4,
    marginMm = 10,
    gapMm = 4,
    cutLines = true,
    fitMode = 'contain',
    dpi = 300,
    quality = 0.95,
    onProgress,
  } = opts

  const [pw, ph] = PAGE_SIZES[pageFormat] || PAGE_SIZES.a4
  const pageW = orientation === 'landscape' ? ph : pw
  const pageH = orientation === 'landscape' ? pw : ph

  const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation })

  const perPage = cols * rows
  const gridW = pageW - marginMm * 2
  const gridH = pageH - marginMm * 2
  const cellW = (gridW - gapMm * (cols - 1)) / cols
  const cellH = (gridH - gapMm * (rows - 1)) / rows

  for (let i = 0; i < items.length; i++) {
    const indexOnPage = i % perPage
    if (i > 0 && indexOnPage === 0) doc.addPage([pageW, pageH], orientation)

    const col = indexOnPage % cols
    const row = Math.floor(indexOnPage / cols)
    const cellX = marginMm + col * (cellW + gapMm)
    const cellY = marginMm + row * (cellH + gapMm)

    const bitmap = await decode(items[i].file)

    let drawW, drawH, x, y
    if (fitMode === 'cover') {
      // Fill the whole cell (image is cropped, not distorted).
      drawW = cellW
      drawH = cellH
      x = cellX
      y = cellY
    } else {
      // Fit the whole image inside the cell, preserving aspect ratio.
      const imgAspect = bitmap.width / bitmap.height
      const cellAspect = cellW / cellH
      if (imgAspect > cellAspect) {
        drawW = cellW
        drawH = cellW / imgAspect
      } else {
        drawH = cellH
        drawW = cellH * imgAspect
      }
      x = cellX + (cellW - drawW) / 2
      y = cellY + (cellH - drawH) / 2
    }

    const dataUrl = rasterize(bitmap, drawW, drawH, dpi, quality, fitMode)
    bitmap.close?.()

    doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST')

    if (cutLines) {
      doc.setDrawColor(170)
      doc.setLineWidth(0.1)
      doc.rect(x, y, drawW, drawH)
    }

    onProgress?.(i + 1, items.length)
  }

  return doc
}

export function pageCount(total, cols, rows) {
  return Math.max(1, Math.ceil(total / (cols * rows)))
}
