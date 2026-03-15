/**
 * Design Token Extractor
 * Analyzes a reference screenshot and extracts colors, proportions, and layout data.
 * Usage: node .claude/reference/analyze.mjs
 */
import sharp from 'sharp';
import { getColor, getPalette } from 'colorthief';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF = resolve(__dirname, 'inventory-target.png');
const OUT = resolve(__dirname, 'design-tokens.json');
const CROPS_DIR = resolve(__dirname, 'crops');

// Image is 1920x1080
const W = 1920;
const H = 1080;

// Define regions to analyze (all in pixels from the reference)
const regions = {
  // Full image
  full: { left: 0, top: 0, width: W, height: H },

  // Left category labels ("UTILITY =", "WORK =")
  sidebar_labels: { left: 0, top: 95, width: 168, height: 230 },

  // Grid area (modules cards)
  grid_area: { left: 168, top: 95, width: 612, height: 560 },

  // Single filled card (ELEVATOR)
  card_elevator: { left: 168, top: 105, width: 185, height: 105 },

  // Single filled card (CORRIDOR)
  card_corridor: { left: 370, top: 105, width: 200, height: 105 },

  // Single filled card (WORKSHOP)
  card_workshop: { left: 168, top: 218, width: 185, height: 105 },

  // Empty card slot
  card_empty: { left: 370, top: 218, width: 200, height: 105 },

  // Details panel (right side)
  details_panel: { left: 810, top: 95, width: 560, height: 560 },

  // Details - 3D preview area
  details_preview: { left: 810, top: 110, width: 560, height: 310 },

  // Details - text area (name + description)
  details_text: { left: 830, top: 425, width: 540, height: 60 },

  // Details - stats area (COST, MASS, SIZE)
  details_stats: { left: 830, top: 570, width: 540, height: 65 },

  // Top bar ("BASE BUILDING" title)
  topbar: { left: 0, top: 0, width: W, height: 45 },

  // Section headings ("MODULES" / "DETAILS")
  heading_modules: { left: 168, top: 55, width: 200, height: 45 },
  heading_details: { left: 1200, top: 55, width: 200, height: 45 },

  // Bottom resource bar
  resource_bar: { left: 370, top: 760, width: 720, height: 55 },

  // Bottom right stats (BASE MASS, JOURNEY COST)
  bottom_stats: { left: 1100, top: 655, width: 300, height: 45 },

  // ESC CLOSE button
  esc_button: { left: 1320, top: 762, width: 120, height: 30 },

  // Card border/edge detail
  card_border_area: { left: 165, top: 102, width: 195, height: 115 },

  // Gap between cards
  card_gap_horizontal: { left: 355, top: 105, width: 18, height: 105 },
  card_gap_vertical: { left: 168, top: 208, width: 185, height: 16 },

  // Category label area
  category_label_utility: { left: 60, top: 108, width: 108, height: 25 },
  category_label_work: { left: 80, top: 220, width: 85, height: 25 },
};

function colorToHex(c) {
  const r = c._r ?? c[0], g = c._g ?? c[1], b = c._b ?? c[2];
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function colorToRGB(c) {
  return [c._r ?? c[0], c._g ?? c[1], c._b ?? c[2]];
}

async function analyzeRegion(name, region) {
  const cropPath = resolve(CROPS_DIR, `${name}.png`);

  // Crop the region
  await sharp(REF)
    .extract(region)
    .toFile(cropPath);

  // Get dominant color
  const dominant = await getColor(cropPath);

  // Get palette (up to 8 colors)
  let palette = [];
  try {
    palette = await getPalette(cropPath, 8);
  } catch (e) {
    palette = [dominant];
  }

  return {
    name,
    dimensions: { width: region.width, height: region.height },
    position: { left: region.left, top: region.top },
    widthPercent: ((region.width / W) * 100).toFixed(2) + '%',
    heightPercent: ((region.height / H) * 100).toFixed(2) + '%',
    dominantColor: colorToHex(dominant),
    dominantRGB: colorToRGB(dominant),
    palette: palette.map(c => ({
      hex: colorToHex(c),
      rgb: colorToRGB(c)
    }))
  };
}

async function main() {
  // Create crops directory
  const { mkdirSync } = await import('fs');
  mkdirSync(CROPS_DIR, { recursive: true });

  console.log('🔬 Analyzing reference image: inventory-target.png (1920x1080)\n');

  const results = {};

  for (const [name, region] of Object.entries(regions)) {
    try {
      results[name] = await analyzeRegion(name, region);
      console.log(`✅ ${name}: ${region.width}x${region.height} @ (${region.left},${region.top}) → dominant: ${results[name].dominantColor}`);
    } catch (e) {
      console.log(`❌ ${name}: ${e.message}`);
    }
  }

  // Compute layout ratios
  const layout = {
    // Sidebar labels width as % of total
    sidebarWidthRatio: (168 / W).toFixed(4),

    // Grid area width as % of total
    gridWidthRatio: (612 / W).toFixed(4),

    // Details panel width as % of total
    detailsWidthRatio: (560 / W).toFixed(4),

    // Card dimensions
    cardWidth: 185,
    cardHeight: 105,
    cardAspectRatio: (185 / 105).toFixed(3),

    // Gaps
    horizontalGap: 17, // px between cards horizontally
    verticalGap: 13,   // px between cards vertically

    // Grid columns
    gridColumns: 3,

    // Grid rows visible
    gridRowsVisible: 5,

    // Details panel start X
    detailsPanelStartX: 810,
    detailsPanelStartPercent: ((810 / W) * 100).toFixed(2) + '%',

    // Heading area height
    headingHeight: 45,

    // Resource bar height
    resourceBarHeight: 55,

    // Total content area (excluding top bar and bottom bar)
    contentAreaTop: 95,
    contentAreaBottom: 650,
  };

  const tokens = {
    imageSize: { width: W, height: H },
    layout,
    regions: results,
    generatedAt: new Date().toISOString()
  };

  writeFileSync(OUT, JSON.stringify(tokens, null, 2));
  console.log(`\n📄 Design tokens saved to: ${OUT}`);
  console.log(`📁 Cropped regions saved to: ${CROPS_DIR}/`);
}

main().catch(console.error);
