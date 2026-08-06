/**
 * Install the farm logo from a local file — copies bytes exactly (no redraw).
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

const publicLogo = path.join(process.cwd(), "public", "logo.png");
const appIcon = path.join(process.cwd(), "src", "app", "icon.png");

fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
fs.copyFileSync(resolved, publicLogo);

// Favicon: scale only (same artwork, smaller dimensions for browser tab).
await sharp(resolved)
  .resize(192, 192, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(appIcon);

console.log(`Installed ${publicLogo} (exact copy)`);
console.log(`Installed ${appIcon} (scaled favicon)`);
