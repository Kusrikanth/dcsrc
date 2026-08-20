import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * pdf.js loads character maps, the base-14 font data and its image-decoder wasm
 * at runtime rather than through the bundler. Mirror those folders into
 * /public so the viewer can fetch them from the app origin - never from a CDN,
 * because a view-only document must not depend on a third-party host.
 *
 * Runs automatically via the predev / prebuild npm scripts. The copies are
 * generated output, so they stay out of git.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist");
const target = join(root, "public", "pdfjs");
const folders = ["cmaps", "standard_fonts", "wasm"];

if (!existsSync(source)) {
  console.error("pdfjs-dist is not installed - run npm install first.");
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const folder of folders) {
  const from = join(source, folder);
  if (!existsSync(from)) {
    console.warn(`Skipped ${folder} - not present in this pdfjs-dist build.`);
    continue;
  }
  await cp(from, join(target, folder), { recursive: true });
}

console.log(`Synced pdf.js assets into public/pdfjs (${folders.join(", ")}).`);
