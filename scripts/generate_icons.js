const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../frontend/assets/icons');
fs.mkdirSync(dir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <text x="256" y="340" font-family="serif" font-size="320"
    font-weight="bold" fill="#FFFFFF" text-anchor="middle">S</text>
</svg>`;

fs.writeFileSync(path.join(dir, 'icon.svg'), svg);
console.log('SVG icon written to frontend/assets/icons/icon.svg');
console.log('IMPORTANT: Convert icon.svg to icon.png (512x512), icon.ico, and icon.icns manually.');
console.log('Use: https://convertio.co or ImageMagick: convert icon.svg -resize 512x512 icon.png');
