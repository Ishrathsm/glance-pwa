import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('./public/assets/icons');
const SVG_FILE = path.resolve('./public/favicon.svg');

if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function resizeImage(size) {
    const outputFile = path.join(ASSETS_DIR, `icon-${size}.png`);
    await sharp(SVG_FILE)
        .resize(size, size, { fit: 'contain', background: { r: 190, g: 242, b: 100, alpha: 1 } }) // #BEF264
        .png()
        .toFile(outputFile);
    console.log(`Generated ${outputFile}`);
}

async function main() {
    await resizeImage(192);
    await resizeImage(512);

    // copy favicon to the root if not there
    if (!fs.existsSync(path.resolve('./public/favicon.svg'))) {
        fs.copyFileSync(SVG_FILE, path.resolve('./public/favicon.svg'));
    }
}

main().catch(console.error);
