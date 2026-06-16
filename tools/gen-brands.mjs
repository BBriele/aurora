// Rasterize the Aurora brand SVGs to the PNGs required by home-assistant/brands,
// trimming fully-transparent borders (brands requires trimmed images).
// Usage: node gen-brands.mjs   (run from the tools/ directory)
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { PNG } from "pngjs";

const BRANDS = "../brands/aurora";

/** Crop fully-transparent rows/columns from a PNG buffer. */
function trim(buf) {
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  let top = height, left = width, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return buf; // fully transparent: leave as-is
  const w = right - left + 1;
  const h = bottom - top + 1;
  if (w === width && h === height) return buf; // already tight
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, left, top, w, h, 0, 0);
  return PNG.sync.write(out);
}

function render(svgPath, outPath, fitWidth) {
  const svg = readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: fitWidth },
    font: { loadSystemFonts: true },
    background: "rgba(0,0,0,0)",
  });
  const png = trim(resvg.render().asPng());
  writeFileSync(outPath, png);
  const { width, height } = PNG.sync.read(png);
  console.log(`✓ ${outPath} — ${width}x${height} (${png.length} bytes)`);
}

// Square icon (full-bleed → trim is a no-op, stays 256/512).
render(`${BRANDS}/icon.svg`, `${BRANDS}/icon.png`, 256);
render(`${BRANDS}/icon.svg`, `${BRANDS}/icon@2x.png`, 512);
// Wide logo (rendered larger, then trimmed tight).
render(`${BRANDS}/logo.svg`, `${BRANDS}/logo.png`, 512);
render(`${BRANDS}/logo.svg`, `${BRANDS}/logo@2x.png`, 1024);
