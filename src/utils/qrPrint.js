// Composite "print as image" helper for selected people.
//
// Strategy:
//   1. Pull every selected person's existing <canvas> (the live QR code rendered
//      by qrcode.react inside their card). This avoids re-rendering and keeps
//      the QR data byte-perfect.
//   2. Draw all of them onto a single master canvas, in a tidy grid:
//      cols depends on count (1..2 → 2 cols, 3..6 → 3 cols, else 4 cols).
//      Each cell is QR (square) + 32px name strip below it.
//   3. The result is exported BOTH as a downloaded PNG AND opened in a hidden
//      print iframe so the user can immediately Ctrl/Cmd+P.

const CELL_QR = 360       // QR side, px
const NAME_H = 56         // Name strip below each QR, px
const PAD = 24            // Outer padding & gap between cells
const FONT = 'bold 22px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

// `selected` is an array of { id, name }.
// `findCanvas(personId)` is a function that returns the live <canvas> element
// for that QR card on the page (or null if not present).
export function printSelectedQRs(selected, findCanvas) {
    if (!selected || selected.length === 0) return

    const cols = pickCols(selected.length)
    const rows = Math.ceil(selected.length / cols)
    const cellW = CELL_QR
    const cellH = CELL_QR + NAME_H

    const width = PAD + cols * (cellW + PAD)
    const height = PAD + rows * (cellH + PAD) + 40 // room for footer

    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d')

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    selected.forEach((p, idx) => {
        const r = Math.floor(idx / cols)
        const c = idx % cols
        const x = PAD + c * (cellW + PAD)
        const y = PAD + r * (cellH + PAD)

        // Cell background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, y, cellW, cellH)
        // Cell border
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)

        // QR
        const sourceCanvas = findCanvas?.(p.id)
        if (sourceCanvas) {
            ctx.drawImage(sourceCanvas, x, y, cellW, cellW)
        } else {
            // Fallback rectangle so layout still prints if a card was scrolled
            // off-DOM (shouldn't happen in current code but defensive).
            ctx.fillStyle = '#f1f5f9'
            ctx.fillRect(x, y, cellW, cellW)
            ctx.fillStyle = '#94a3b8'
            ctx.font = FONT
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('QR not in DOM', x + cellW / 2, y + cellW / 2)
        }

        // Name strip
        ctx.fillStyle = '#0f172a'
        ctx.font = FONT
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const name = truncate(p.name, 28)
        ctx.fillText(name, x + cellW / 2, y + cellW + NAME_H / 2)
    })

    // Footer
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
        `${selected.length} QR code${selected.length === 1 ? '' : 's'} · QR Attendance`,
        width / 2,
        height - 22
    )

    const dataUrl = out.toDataURL('image/png')

    // 1) Trigger download.
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-codes-${selected.length}.png`
    a.click()

    // 2) Open print dialog with just the image (separate iframe so the rest of
    //    the page's UI is not part of the printed document).
    openPrintWindow(dataUrl, selected.length)
}

function pickCols(n) {
    if (n <= 2) return Math.max(n, 1)
    if (n <= 6) return 3
    return 4
}

function truncate(str, max) {
    if (!str) return ''
    return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

function openPrintWindow(dataUrl, count) {
    // Use a hidden iframe so we don't rely on popup permissions.
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>QR Codes (${count})</title>
<style>
  @page { margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; height: auto; image-rendering: pixelated; }
</style></head>
<body><img src="${dataUrl}" alt="QR codes"/></body></html>`)
    doc.close()

    // Wait for image to load, then print.
    const img = doc.querySelector('img')
    function go() {
        try {
            iframe.contentWindow.focus()
            iframe.contentWindow.print()
        } catch {
            /* swallow */
        }
        // Clean up after a delay so the print dialog can finish.
        setTimeout(() => iframe.remove(), 60_000)
    }
    if (img.complete) {
        setTimeout(go, 50)
    } else {
        img.onload = () => setTimeout(go, 50)
    }
}
