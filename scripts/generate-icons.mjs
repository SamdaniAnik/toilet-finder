// Generates the app icons from one SVG design.
// Run: node scripts/generate-icons.mjs   (uses sharp, which ships with Next.js)
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const BLUE = "#2563eb";

/** White map pin with a simple toilet inside. `pad` shrinks the art for maskable icons. */
function svg(size, { pad = 0, rounded = true } = {}) {
  const s = 512;
  const inner = s * (1 - pad * 2);
  const k = inner / s;
  const off = s * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="${BLUE}"/>
  <g transform="translate(${off} ${off}) scale(${k})">
    <path d="M256 64c-79.5 0-144 62.6-144 140 0 99 144 244 144 244s144-145 144-244c0-77.4-64.5-140-144-140z" fill="#fff"/>
    <!-- toilet: tank, seat, bowl -->
    <rect x="196" y="130" width="54" height="78" rx="10" fill="${BLUE}"/>
    <rect x="186" y="200" width="140" height="22" rx="11" fill="${BLUE}"/>
    <path d="M196 222h120c0 38-24 62-60 62h-8l8 34h-52l10-40c-12-12-18-32-18-56z" fill="${BLUE}"/>
  </g>
</svg>`;
}

const outputs = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  // Maskable: full-bleed background, art kept inside the 80% safe zone.
  { file: "public/icons/maskable-512.png", size: 512, opts: { pad: 0.1, rounded: false } },
  { file: "src/app/icon.png", size: 64 },
  { file: "src/app/apple-icon.png", size: 180, opts: { rounded: false } },
];

await mkdir("public/icons", { recursive: true });
for (const { file, size, opts } of outputs) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file);
  console.log("wrote", file);
}
