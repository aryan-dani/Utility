import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Cursor browser screenshots land on a ~3230×2080 canvas with the real
 * viewport pixels only in the top-left. Trim empty paper/black margins.
 */
export async function trimScreenshot(inputPath, outputPath = inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const isEmpty = (r, g, b, a) => {
    if (a < 8) return true;
    if (r > 248 && g > 248 && b > 248) return true;
    if (r <= 14 && g <= 14 && b <= 16) return true;
    return false;
  };

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (!isEmpty(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) {
    throw new Error(`No content pixels in ${inputPath}`);
  }

  const box = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  const fills = box.width / width > 0.98 && box.height / height > 0.98;
  if (fills && path.resolve(inputPath) === path.resolve(outputPath)) {
    return { trimmed: false, ...box, fullW: width, fullH: height };
  }

  const tmp = `${outputPath}.trim-tmp.png`;
  await sharp(inputPath).extract(box).png({ compressionLevel: 9 }).toFile(tmp);
  fs.renameSync(tmp, outputPath);
  return { trimmed: true, ...box, fullW: width, fullH: height };
}

const dir = process.argv[2] || "docs/linkedin-media";
const files = fs
  .readdirSync(dir)
  .filter((f) => /\.png$/i.test(f) && !f.startsWith("_"))
  .sort();

for (const name of files) {
  const file = path.join(dir, name);
  const result = await trimScreenshot(file);
  console.log(
    result.trimmed ? "trimmed" : "ok",
    name,
    `${result.fullW}x${result.fullH}`,
    "->",
    `${result.width}x${result.height}`,
  );
}
