#!/usr/bin/env node
// Writes the update manifests for the release being built, so installed copies
// update themselves:
//
//   dist/updates.json  Firefox  (manifest: browser_specific_settings.gecko.update_url)
//   dist/updates.xml   Chromium (manifest: update_url, used by policy installs)
//
// Both are attached to every release; the manifests point at
// …/releases/latest/download/, which always resolves to the newest release.
// A file is only written when the matching signed package exists in dist/.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ID as CHROMIUM_ID } from "./chromium-key.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const { version, homepage_url: repoUrl } = manifest;
const geckoId = manifest.browser_specific_settings.gecko.id;
const download = `${repoUrl}/releases/download/v${version}`;

const xpi = `claude-smooth-${version}-firefox.xpi`;
if (existsSync(join(dist, xpi))) {
  const updates = {
    addons: { [geckoId]: { updates: [{ version, update_link: `${download}/${xpi}` }] } }
  };
  writeFileSync(join(dist, "updates.json"), JSON.stringify(updates, null, 2) + "\n");
  console.log("✓ updates.json →", xpi);
} else {
  console.log("– no signed .xpi, skipping updates.json");
}

const crx = `claude-smooth-${version}-chromium.crx`;
if (existsSync(join(dist, crx))) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="${CHROMIUM_ID}">
    <updatecheck codebase="${download}/${crx}" version="${version}" />
  </app>
</gupdate>
`;
  writeFileSync(join(dist, "updates.xml"), xml);
  console.log("✓ updates.xml  →", crx);
} else {
  console.log("– no signed .crx, skipping updates.xml");
}
