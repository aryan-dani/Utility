import fs from "fs";
import path from "path";
const dir = "C:/Users/dania/.cursor/browser-logs";
const out = process.argv[2];
if (!out) {
  console.error("usage: node save-latest-shot.mjs <out.jpg>");
  process.exit(1);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("cdp-response-Page.captureScreenshot"))
  .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
const j = JSON.parse(fs.readFileSync(path.join(dir, files[0].f), "utf8"));
fs.writeFileSync(out, Buffer.from(j.data, "base64"));
console.log(path.basename(out), fs.statSync(out).size, files[0].f);
