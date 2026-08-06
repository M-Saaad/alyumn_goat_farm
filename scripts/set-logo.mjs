/**
 * Install the farm logo from a local file (PNG/JPEG/WebP).
 * Converts to PNG for web use without altering the artwork; generates PWA icons.
 * Usage: node scripts/set-logo.mjs /path/to/your/logo.png
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const src = process.argv[2];
if (!src?.trim()) {
  console.error("Usage: node scripts/set-logo.mjs /path/to/your/logo.png");
  process.exit(1);
}

const resolved = path.resolve(src);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const root = process.cwd();
const publicLogo = path.join(root, "public", "logo.png");
const appIcon = path.join(root, "src", "app", "icon.png");
const appleIcon = path.join(root, "src", "app", "apple-icon.png");
const iconsDir = path.join(root, "public", "icons");

fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

const image = sharp(resolved);

// Full logo for in-app display (same pixels, PNG container).
await image.clone().png().toFile(publicLogo);

async function writeIcon(size, dest) {
  await sharp(resolved)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(dest);
}

await writeIcon(192, appIcon);
await writeIcon(180, appleIcon);
await writeIcon(192, path.join(iconsDir, "icon-192.png"));
await writeIcon(512, path.join(iconsDir, "icon-512.png"));

console.log(`Installed ${publicLogo}`);
console.log(`Installed ${appIcon} (favicon)`);
console.log(`Installed ${appleIcon} (iOS home screen)`);
console.log(`Installed ${path.join(iconsDir, "icon-192.png")} and icon-512.png (PWA)`);
