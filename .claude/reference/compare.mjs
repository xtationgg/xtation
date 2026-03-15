/**
 * Visual Diff Tool
 * Compares a screenshot of the current build against the reference design.
 * Outputs a diff image highlighting every pixel that doesn't match.
 *
 * Usage: node .claude/reference/compare.mjs <screenshot.png>
 * Output: .claude/reference/diff.png
 *
 * The reference is auto-resized to match the screenshot dimensions.
 */
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_PATH = resolve(__dirname, 'inventory-target.png');
const DIFF_PATH = resolve(__dirname, 'diff.png');

async function main() {
  const screenshotPath = process.argv[2];
  if (!screenshotPath) {
    console.error('Usage: node compare.mjs <screenshot.png>');
    process.exit(1);
  }

  // Read screenshot to get its dimensions
  const shotMeta = await sharp(screenshotPath).metadata();
  const W = shotMeta.width;
  const H = shotMeta.height;
  console.log(`📸 Screenshot: ${W}x${H}`);

  // Resize reference to match screenshot dimensions
  const refBuffer = await sharp(REF_PATH)
    .resize(W, H, { fit: 'fill' })
    .png()
    .toBuffer();

  const shotBuffer = await sharp(screenshotPath)
    .png()
    .toBuffer();

  const refImg = PNG.sync.read(refBuffer);
  const shotImg = PNG.sync.read(shotBuffer);

  const diff = new PNG({ width: W, height: H });

  const numDiff = pixelmatch(
    refImg.data,
    shotImg.data,
    diff.data,
    W,
    H,
    {
      threshold: 0.15,          // Color distance threshold (0-1)
      includeAA: false,         // Skip anti-aliased pixels
      alpha: 0.3,               // Opacity of original image in diff
      diffColor: [255, 0, 0],   // Red for different pixels
      diffColorAlt: [0, 255, 0] // Green for anti-aliased diffs
    }
  );

  writeFileSync(DIFF_PATH, PNG.sync.write(diff));

  const totalPixels = W * H;
  const matchPercent = (((totalPixels - numDiff) / totalPixels) * 100).toFixed(2);

  console.log(`\n🔍 Comparison Results:`);
  console.log(`   Total pixels:    ${totalPixels.toLocaleString()}`);
  console.log(`   Different:       ${numDiff.toLocaleString()}`);
  console.log(`   Match:           ${matchPercent}%`);
  console.log(`\n📄 Diff image saved to: ${DIFF_PATH}`);

  if (numDiff === 0) {
    console.log(`\n🎯 PIXEL PERFECT! No differences found.`);
  } else if (parseFloat(matchPercent) > 95) {
    console.log(`\n✅ Very close! Minor differences remain.`);
  } else if (parseFloat(matchPercent) > 80) {
    console.log(`\n⚠️  Good progress, but visible differences remain.`);
  } else {
    console.log(`\n❌ Significant differences. Check diff.png for details.`);
  }
}

main().catch(console.error);
