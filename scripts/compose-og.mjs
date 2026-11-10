import sharp from "sharp";
import fs from "fs";
import path from "path";

const outDir = "src/app";
const desk = "docs/linkedin-media/01-home-desk.png";
const W = 1200;
const H = 630;
const rightW = 720;
const frameH = 560;
const chromeH = 36;
const contentH = frameH - chromeH;
const pad = 36;

const left = W - rightW - pad;
const frameY = Math.round((H - frameH) / 2);

const shot = await sharp(desk)
  .resize(rightW, contentH, { fit: "cover", position: "left top" })
  .png()
  .toBuffer();

const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e4e4e7" stroke-width="1"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fafafa"/>
      <stop offset="100%" stop-color="#f4f4f5"/>
    </linearGradient>
    <clipPath id="shotClip">
      <rect x="${left}" y="${frameY + chromeH}" width="${rightW}" height="${contentH}" rx="0" ry="0"/>
    </clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.55"/>
  <text x="52" y="200" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="700" fill="#09090b">Utility OS</text>
  <text x="52" y="246" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#52525b">MIT-WPU study workspace</text>
  <rect x="52" y="286" rx="999" ry="999" width="100" height="34" fill="#e4e4e7"/>
  <text x="102" y="308" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#27272a">Syllabus</text>
  <rect x="164" y="286" rx="999" ry="999" width="110" height="34" fill="#e4e4e7"/>
  <text x="219" y="308" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#27272a">Resources</text>
  <rect x="286" y="286" rx="999" ry="999" width="86" height="34" fill="#e4e4e7"/>
  <text x="329" y="308" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#27272a">Ask AI</text>
  <text x="52" y="560" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#71717a">utilityos.tech</text>
  <rect x="${left}" y="${frameY}" width="${rightW}" height="${frameH}" rx="16" ry="16" fill="#ffffff" stroke="#d4d4d8" stroke-width="1"/>
  <circle cx="${left + 22}" cy="${frameY + 18}" r="5" fill="#f87171"/>
  <circle cx="${left + 40}" cy="${frameY + 18}" r="5" fill="#fbbf24"/>
  <circle cx="${left + 58}" cy="${frameY + 18}" r="5" fill="#4ade80"/>
</svg>`);

const ogPath = path.join(outDir, "opengraph-image.png");
const twPath = path.join(outDir, "twitter-image.png");

await sharp(svg)
  .composite([
    {
      input: shot,
      left,
      top: frameY + chromeH,
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(ogPath);

await sharp(ogPath).toFile(twPath);

const meta = await sharp(ogPath).metadata();
console.log("wrote", meta.width, meta.height, fs.statSync(ogPath).size);
