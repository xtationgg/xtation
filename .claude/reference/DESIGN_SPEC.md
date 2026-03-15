# Inventory Design Spec — The Alters: Base Building Modules

Extracted from: `inventory-target.png` (1920x1080)
Generated: 2026-03-14

---

## 1. OVERALL LAYOUT (1920x1080 reference)

```
+------------------------------------------------------------------+
|                    "BASE BUILDING" (top bar)                      |  ~40px
+--------+-----------------------------------------+----------------+
|        |  MODULES (heading)                      | DETAILS (head) |  ~35px
|  CAT   +--+--------+--------+--------+          +----------------+
| LABELS |  | CARD 1 | CARD 2 | CARD 3 |  gap     |                |
|  ~9%   |  +--------+--------+--------+  ~3%     |   3D PREVIEW   |
|  width |  | CARD 4 | CARD 5 | CARD 6 |          |   AREA (60%)   |
|        |  +--------+--------+--------+          |                |
|        |  | CARD 7 | CARD 8 | CARD 9 |          +----------------+
|        |  +--------+--------+--------+          | NAME           |
|        |  | CARD10 | CARD11 | CARD12 |          | Description    |
|        |  +--------+--------+--------+          +----------------+
|        |  | CARD13 | CARD14 | CARD15 |          | COST  MASS SIZE|
+--------+-----------------------------------------+----------------+
|        BASE MASS / JOURNEY COST stats (right-aligned)             |
+------------------------------------------------------------------+
| [resources: metals rapidium minerals etc]  [storage]  [ESC CLOSE] |  ~50px
+------------------------------------------------------------------+
```

### Column proportions (from pixel measurements):
- **Category labels column**: 168px = **8.75%** of 1920px
- **Grid area**: 612px = **31.9%** (starts at x:168, ends at x:780)
- **Gap between grid & details**: ~30px = **1.6%**
- **Details panel**: 560px = **29.2%** (starts at x:810)
- **Right margin**: ~550px = **28.6%**

### Row proportions:
- **Top bar**: 40px = **3.7%** of 1080px
- **Headings row**: 35px = **3.2%**
- **Content area** (grid + details): ~560px = **51.9%** (y:95 to y:655)
- **Dead space / stats**: ~105px (y:655 to y:760)
- **Resource bar**: ~50px = **4.6%**
- **Bottom margin**: ~270px

---

## 2. COLOR PALETTE (extracted via ColorThief)

### Background Colors
| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| Page BG | `#12120f` | (18,18,15) | Very dark warm black |
| Top bar BG | `#1f1e1b` | (31,30,27) | Slightly lighter warm dark |
| Sidebar labels area | `#1f1e1b` | (31,30,27) | Same as top bar |
| Grid area BG | `#0b0907` | (11,9,7) | Near-black, warm tint |
| Details panel BG | `#0d0d0a` | (13,13,10) | Near-black |
| Resource bar BG | `#1c2020` | (28,32,32) | Dark gray with slight cool tint |

### Card Colors
| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| Filled card BG | `#090705` | (9,7,5) | Almost pure black, warm |
| Selected card (Corridor) | `#232725` | (35,39,37) | Slightly lighter = selected state |
| Empty slot | `#000000` | (0,0,0) | Pure black |
| Card border (visible) | `#1e1d1a` | (30,29,26) | Very subtle warm gray |
| Card gap/grid lines | `#212121` | (33,33,33) | Neutral dark gray between cards |
| Horizontal gap dominant | `#292b2b` | (41,43,43) | Slightly lighter than vertical |

### Text Colors
| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| Heading text (MODULES) | `#abaaa6` | (171,170,166) | Warm off-white |
| Card name text | `#bcbab3` | (188,186,179) | Light warm gray |
| Description text | `#a2a8a6` | (162,168,166) | Slightly cooler gray |
| Small labels (COST etc) | `#bebcb8` | (190,188,184) | Similar to card text |
| Category labels (UTILITY) | `#c3bfbc` | (195,191,188) | Warm light gray |

### Accent Colors (detected in palette)
| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| Pink/magenta accent | `#942f76` | (148,47,118) | Found on card border decorations |
| Gold/amber accent | `#d8ac61` | (216,172,97) | Found on card icons/badges |
| Workshop teal | `#1f2e31` | (31,46,49) | Card has slight teal tint |

---

## 3. CARD DESIGN (Detailed)

### Dimensions
- **Card size**: ~200x108px at 1920w = **10.4% x 10%** of viewport
- **Aspect ratio**: 1.85:1 (wider than tall)
- **Grid**: 3 columns
- **Horizontal gap**: ~18px (0.94% of 1920)
- **Vertical gap**: ~16px (1.48% of 1080)
- **Border radius**: ~8px (very subtle rounded corners)

### Card Internal Layout
```
+------------------------------------------+
| NAME (top-left, uppercase)     [ICON]    |
|                                [64x64]   |
|                                [box]     |
| [cost-icon] COST_NUM (bottom-left)       |
+------------------------------------------+
```

- **Name**: Top-left, uppercase, ~13px, font-weight ~500-600, letter-spacing ~0.5px
- **Icon**: Right side, centered vertically, inside a subtle bordered square (~64x64px)
- **Icon box border**: Very thin (~1px), color ~#3a3e3d (subtle gray)
- **Cost badge**: Bottom-left, small icon + number, ~11px
- **Card BG**: Nearly black (#090705) with very subtle border (#1e1d1a, 1px)
- **Selected state**: Background shifts to #232725 (brighter), possibly subtle border highlight

### Empty Slot
- Pure black (#000000) background
- Very faint border visible when brightened (~#1a1a1a)
- Same dimensions as filled cards
- No content, no icon

---

## 4. CATEGORY LABELS (Left Sidebar)

### Layout
- Positioned flush-left, vertically aligned with their card rows
- Text: uppercase, ~12px, font-weight 400-500
- Color: warm light gray (#c3bfbc)
- After text: small "=" sign, followed by a horizontal connector to cards
- Connector: thin line, color ~#942f76 (pink accent)

### Observed categories:
1. **UTILITY** — aligned with row 1 (Elevator, Corridor)
2. **WORK** — aligned with row 2 (Workshop)

### Proportions:
- Label width area: ~108px (5.6% of 1920)
- Label + connector: ~168px total (8.75%)
- Vertical spacing matches card row positions exactly

---

## 5. DETAILS PANEL (Right Side)

### Container
- Starts at x:810 (42.2% from left)
- Width: 560px (29.2%)
- Height: matches grid area (~560px)
- Background: #0d0d0a (near-black)
- Border: subtle, rounded corners ~12px
- Clear separation from grid (30px gap)

### Internal Layout (top to bottom):
```
+--------------------------------------+
|                                      |
|           3D PREVIEW                 |  ~60% of panel height
|         (dark background)            |
|           #1d2121                    |
|                                      |
+--------------------------------------+
|  NAME (bold, white, ~18px)           |  ~8%
|  Description (gray, ~14px)           |
+--------------------------------------+
|                                      |
|         (empty space)                |  ~20%
|                                      |
+--------------------------------------+
| COST        |    MASS    |   SIZE    |  ~12%
| [icon] 10   |   [icon]2  |  [icon]   |
+--------------------------------------+
```

### Preview Area
- BG: #1d2121 (dark gray, slightly lighter than card BG)
- 3D model rendered as wireframe/ghost (white/transparent edges)
- Takes ~60% of panel height

### Info Area
- **Name**: Bold, uppercase, ~18px, white (#bcbbb7)
- **Description**: Regular weight, ~14px, gray (#a2a8a6), one line

### Stats Row (bottom)
- Three columns: COST, MASS, SIZE
- Label: uppercase, ~10px, gray
- Value: below label, icon + number or icon only
- Separated by space, right-aligned for MASS and SIZE
- MASS value in a subtle bordered box (~28x28px)

---

## 6. HEADINGS (MODULES / DETAILS)

- **Font**: Bold, uppercase, ~20px
- **Color**: Warm off-white (#abaaa6)
- **Decoration**: Decorative dashed/striped underline (3-4 horizontal stripes)
- **Underline color**: appears to be multi-line strikethrough effect, ~#6c6c68
- **MODULES**: left-aligned at x:168 (grid start)
- **DETAILS**: right-aligned at x:~1280

---

## 7. RESOURCE BAR (Bottom)

### Position & Size
- Full width, docked to bottom
- Height: ~50px
- BG: #1c2020 (dark gray-teal)

### Content (left to right):
```
[icon] 050   [icon] 060   [icon] 000   [icon] 002   [icon] 019   [icon] 000   336.00/480.00   [icon] 108/300
 metals      rapidium     minerals    enriched    raw food      mush      cooked meal     storage    organics
                                      metals
```

### Text Style
- Numbers: ~14px, bold, white
- Labels: ~9px, uppercase, gray (#6d706c)
- Monospace-like number formatting (zero-padded: "050", "060")
- Resource groups separated by ~40px

---

## 8. TYPOGRAPHY SUMMARY

| Usage | Size (est.) | Weight | Case | Color |
|-------|------------|--------|------|-------|
| Top bar title (BASE BUILDING) | 14px | 500 | Upper | #bcbab3 |
| Section heading (MODULES) | 20px | 700 | Upper | #abaaa6 |
| Card name | 13px | 500-600 | Upper | #bcbab3 |
| Card cost number | 12px | 500 | Normal | #bcbab3 |
| Category label (UTILITY) | 11px | 400-500 | Upper | #c3bfbc |
| Details name | 18px | 700 | Upper | #bcbbb7 |
| Details description | 14px | 400 | Sentence | #a2a8a6 |
| Details stat label (COST) | 10px | 500 | Upper | #bebcb8 |
| Resource number | 14px | 600 | Normal | #bcbab3 |
| Resource label | 9px | 400 | Lower | #6d706c |

---

## 9. KEY CSS VARIABLES TO USE

```css
/* Backgrounds */
--inv-bg: #12120f;
--inv-topbar-bg: #1f1e1b;
--inv-card-bg: #090705;
--inv-card-bg-selected: #232725;
--inv-card-bg-empty: #000000;
--inv-details-bg: #0d0d0a;
--inv-preview-bg: #1d2121;
--inv-bar-bg: #1c2020;
--inv-grid-gap-color: #212121;

/* Borders */
--inv-card-border: #1e1d1a;
--inv-card-border-selected: #3a3e3d;
--inv-icon-box-border: #3a3e3d;

/* Text */
--inv-text-heading: #abaaa6;
--inv-text-primary: #bcbab3;
--inv-text-secondary: #a2a8a6;
--inv-text-muted: #6d706c;
--inv-text-label: #bebcb8;
--inv-text-category: #c3bfbc;

/* Accents */
--inv-accent-pink: #942f76;
--inv-accent-gold: #d8ac61;

/* Layout */
--inv-sidebar-width: 8.75%;
--inv-grid-width: 31.9%;
--inv-details-width: 29.2%;
--inv-card-gap-h: 18px;
--inv-card-gap-v: 16px;
--inv-card-radius: 8px;
--inv-panel-radius: 12px;
```

---

## 10. CRITICAL VISUAL DETAILS

1. **Everything is VERY dark** — the differences between BG and cards are only ~10-20 RGB values
2. **Warm undertone** — blacks lean slightly brown/amber (R slightly > G > B)
3. **No bright accents** in normal state — the pink and gold only appear on specific elements
4. **Grid lines are barely visible** — they're the BG showing through the card gaps
5. **Empty slots are distinguishable** only by the faintest border difference
6. **Selected card** is only ~25 RGB values brighter than unselected
7. **Font weight is light** — nothing feels heavy/bold except headings
8. **Clean, minimal** — very few decorative elements, lots of negative space
9. **Icon boxes** inside cards have thin geometric borders (1px, #3a3e3d)
10. **The decorative underline** on MODULES/DETAILS is a distinctive multi-stripe pattern
