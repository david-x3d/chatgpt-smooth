#!/usr/bin/env node
// Builds the extension for both browser families from the files in the repo root:
//
//   dist/firefox/   + dist/chatgpt-smooth-<version>-firefox.zip    (Gecko: Firefox, Floorp, Zen, LibreWolf …)
//   dist/chromium/  + dist/chatgpt-smooth-<version>-chromium.zip   (Chrome, Edge, Brave, Vivaldi, Helium …)
//
// manifest.json in the root is the Firefox manifest (so the folder can be loaded
// directly via about:debugging). The Chromium manifest is derived from it.
// No dependencies, only Node ≥ 18 and the `zip` command.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_KEY } from "./chromium-key.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const FILES = ["smooth.js", "smooth.css", "popup.html", "popup.js", "icons"];

const PNG_ICONS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png"
};

const firefox = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const { version, homepage_url: repoUrl } = firefox;

const chromium = structuredClone(firefox);
delete chromium.browser_specific_settings; // Gecko-only
chromium.icons = PNG_ICONS;                // Chromium can't use SVG icons
chromium.action.default_icon = PNG_ICONS;
chromium.minimum_chrome_version = "117";   // linear() easing, @starting-style
chromium.key = PUBLIC_KEY; // independent identity from Claude Smooth
chromium.update_url = `${repoUrl}/releases/latest/download/updates.xml`;

rmSync(dist, { recursive: true, force: true });

for (const [target, manifest] of Object.entries({ firefox, chromium })) {
  const dir = join(dist, target);
  mkdirSync(dir, { recursive: true });
  for (const file of FILES) cpSync(join(root, file), join(dir, file), { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const zip = join(dist, `chatgpt-smooth-${version}-${target}.zip`);
  execFileSync("zip", ["-qr9X", zip, "."], { cwd: dir });
  console.log(`✓ ${target.padEnd(8)} ${zip.slice(root.length + 1)}`);
}
