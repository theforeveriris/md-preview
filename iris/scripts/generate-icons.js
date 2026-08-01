const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'iris', 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const COLORS = {
  bg1: { r: 212, g: 165, b: 201 },
  bg2: { r: 242, g: 196, b: 206 },
  fg: { r: 255, g: 255, b: 255 }
};

function svgNormal(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4a5c9"/>
      <stop offset="100%" stop-color="#f2c4ce"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="360" font-family="Georgia, serif" font-size="360" font-weight="700" text-anchor="middle" fill="white">M</text>
</svg>`;
}

function svgMaskable(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="#d4a5c9"/>
  <text x="256" y="360" font-family="Georgia, serif" font-size="240" font-weight="700" text-anchor="middle" fill="white">M</text>
</svg>`;
}

async function generate() {
  await sharp(Buffer.from(svgNormal(512)))
    .resize(192, 192)
    .png()
    .toFile(path.join(OUT_DIR, 'icon-192.png'));

  await sharp(Buffer.from(svgNormal(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_DIR, 'icon-512.png'));

  await sharp(Buffer.from(svgNormal(180)))
    .resize(180, 180)
    .png()
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));

  await sharp(Buffer.from(svgMaskable(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_DIR, 'icon-maskable-512.png'));

  await sharp(Buffer.from(svgNormal(32)))
    .resize(32, 32)
    .png()
    .toFile(path.join(OUT_DIR, 'favicon-32.png'));

  console.log('✅ Generated PNG icons');
}

generate().catch(err => { console.error(err); process.exit(1); });
