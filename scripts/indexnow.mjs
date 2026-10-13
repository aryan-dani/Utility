import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pages from "../src/lib/publicPages.json" with { type: "json" };

/**
 * Ping IndexNow (Bing, Yandex, Naver, Seznam) after the sitemap is deployed.
 * The key file must already be live at https://utilityos.tech/{key}.txt.
 *
 *   node scripts/indexnow.mjs
 */

const HOST = "utilityos.tech";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const keyFiles = readdirSync(publicDir).filter((name) =>
  /^[a-f0-9]{32}\.txt$/.test(name),
);
if (keyFiles.length !== 1) {
  console.error("Expected one public/{32-hex}.txt IndexNow key file");
  process.exit(1);
}
const key = keyFiles[0].replace(/\.txt$/, "");
const body = readFileSync(path.join(publicDir, keyFiles[0]), "utf8").trim();
if (body !== key) {
  console.error("IndexNow key file body does not match its filename");
  process.exit(1);
}

function absoluteUrl(pagePath) {
  return pagePath === "/" ? `https://${HOST}` : `https://${HOST}${pagePath}`;
}

const payload = {
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${key}.txt`,
  urlList: pages.map((page) => absoluteUrl(page.path)),
};

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

if (!response.ok && response.status !== 202) {
  const text = await response.text();
  console.error(`IndexNow failed: ${response.status} ${text}`);
  process.exit(1);
}

console.log(`IndexNow accepted ${payload.urlList.length} URLs (${response.status})`);
