# PROJECT DNA
**Project:** XTATION
**Type:** Website / App (Game-style Dashboard OS)
**Last Updated:** 2026-03-11 | **Session:** 2 | **AI:** GPT-5.2 Thinking

---

## ★ QUICK READ — AI STARTS HERE EVERY SESSION
> Read this block first. It is all you need to start working.
> Only read sections below if you need specific details.

```
COMPLETION:   23/25 layers | 18 components
DONE:         Identity, Colors, Typography, Layout, Visual Language, Iconography,
              Component States, Motion, Game Feel, Accessibility, Performance,
              Failure States, Microcopy, Tech Stack
PARTIAL:      IA, State Machines, Onboarding, User Types, Sound Direction,
              Context Preservation, Success Metrics, Peak-End
MISSING:      (none)

COMPONENTS:   Button, Tabs, Card/Panel, List Item, Modal, Tooltip, Toast,
              Slider, Toggle, Checkbox, Search Input, Progress/Spinner,
              Skeleton, Data Table, HUD Chip/Pill, Badge/Tag, Stepper

THIS SESSION: Tighten XTATION skin to measurable tokens (Control-style) and
              mark Status checkboxes strictly.
LOCKED:       Minimalist black-first UI; Accent Red for danger/selection;
              Teal for positive/system; Sharp corners; Borders not shadows;
              Big whitespace + thin type; No bouncy motion.
LAST SESSION: Session 1 — Drafted full DNA, rule-level tokens.
```

> **After finishing your session, update this QUICK READ block.**
> Replace the numbers and lists above to reflect the new state.
> Then append a SESSION entry and any DECISIONS at the bottom.
> Keep this block under 150 tokens — always.

---
---

## HOW TO USE THIS FILE

**For the AI:**
- Read QUICK READ block above — that is your starting context every session
- Read specific sections below only when you need detail on that topic
- After every session: update QUICK READ + append to SESSIONS + append to DECISIONS
- Never rewrite history — only append to logs
- Keep QUICK READ compact (under 150 tokens)

**For the human:**
- Fill this file through chat with an AI (Discovery Mode below) or through the Studio tool
- Share this file at the start of every AI session — nothing else needed
- After each session, paste the AI's update back into this file
- Open UXDNA_VIEWER.html anytime to see this file displayed visually

**Discovery Mode — if you don't know what to fill:**
Tell the AI: *"Read this empty file. Ask me questions one at a time and fill it as we talk."*
The AI will ask simple questions. You answer however you want — words, images, references, examples.
No design knowledge needed.

---
---

## DESIGN SPEC

### Project Identity
```
Name:               XTATION
Type:               Game-like Operating System / Dashboard
Platform:           Web (desktop-first), later cross-platform
Audience:           builders/creators/students/operators who want a life OS that feels like a game client
Emotional Goal:     in control, focused, “mission-ready”, calm intensity
Functional Goal:    execute quests, track progress, manage systems/projects with clarity
Personality:        cinematic, precise, minimal, authoritative, mysterious
References:         Control (UI + mood), Hitman (career dashboards), AAA HUD dashboards
Anti-References:    colorful SaaS, bubbly rounded UI, heavy gradients, glassmorphism overload
```

---

### Layer 01 — Color System
```
Background Primary:    #070708   deepest background
Background Secondary:  #0E0F12   panels and cards
Background Tertiary:   #151821   nested elements
Accent Primary:        #E0002A   main interactive/alert color
Accent Secondary:      #25D6C6   supporting/system highlight
Text Primary:          #F2F4F8   main readable text
Text Secondary:        #A7AFBD   labels and supporting text
Border Default:        #FFFFFF1A standard borders (low opacity)
Glow Color:            #E0002A66 bloom and glow effects (subtle)

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Use “inversion selection”: selected items become light surfaces with dark text.
```

---

### Layer 02 — Typography
```
Primary Font:     Inter — weights: 400, 500, 600
Secondary Font:   IBM Plex Sans Condensed — weights: 500, 700 (ALL CAPS headings)
Mono Font:        IBM Plex Mono — weights: 400, 500 (values, IDs, counters)
Display Font:     (none — keep wordmark simple)
Character Style:  Industrial / geometric sans, high legibility

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Headings use caps + tracking (0.08–0.12em). Body stays mixed-case.
```

---

### Layer 03 — Spacing & Layout
```
Base Unit:          4px
Grid Columns:       12 (desktop) / 6 (tablet) / 4 (mobile)
Max Content Width:  1200px (primary panels), 1440px (wide canvases)
Density:            Compact

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Prefer large outer margins + tight inner controls. Empty space is a feature.
```

---

### Layer 04 — Visual Language & Framing
```
Corner Radius:      Sharp 2px (never pill)
Border Style:       1px low-opacity; sometimes left-accent line
Element Style:      Filled (translucent) + outlined frames
Elevation System:   Flat (no shadows). Depth comes from blur/opacity.
Density Feel:       Tight but breathable (big canvas, small controls)

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Panels are translucent black with subtle blur; borders are the main separator.
```

---

### Layer 05 — Iconography
```
Icon Style:   Mostly outline, filled only for strong status
Icon Set:     Lucide (base) + custom triangles/chevrons (game markers)
Icon Sizes:   16 / 20 / 24px

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Use triangle markers (red) for “new/attention” like Control.
```

---

### Layer 06 — Component States
> Every component must have all 7 states designed:
> Default → Hover → Focus → Active → Selected → Disabled → Loading

```
Components defined:
- [x] Button (Primary / Secondary / Ghost / Destructive)
- [x] Input (Text / Search)
- [x] Checkbox / Toggle
- [x] Select / Dropdown
- [x] Slider
- [x] Modal / Dialog
- [x] Tooltip
- [x] Toast / Notification
- [x] Card / Panel
- [x] Navigation (Tabs / Sidebar)
- [x] Progress / Spinner
- [x] Skeleton / Loading placeholder
- [x] List item row (selectable)
- [x] Badge / Tag

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: State deltas are subtle: opacity + border + accent line. Focus ring is a 1px teal outline.
Default: thin outline, low contrast
Hover: border brightens + subtle lift (1–2px translate)
Focus: visible accent ring (teal) + border
Active: compress feel (scale 0.98) for 80ms
Selected: inverted surface (light panel + dark text)
Disabled: opacity 0.4, no glow
Loading: inline spinner, preserve layout
```

---

### Layer 07 — Motion Language
```
Motion Style:     Instant & sharp (with occasional cinematic fades)
Timing Scale:     fast:80ms normal:160ms slow:240ms cinematic:420ms
Easing Style:     cubic-bezier(0.2, 0.0, 0.0, 1.0) (clean ease-out)
Reduced Motion:   Handled yes (disable parallax, reduce blur transitions)

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Default pattern = fade + 4–12px slide. No bounce. No elastic springs.
```

---

### Layer 08 — Game Feel / Juice
```
Button press spring:      [x] yes  [ ] no
Screen shake on impact:   [ ] yes  [x] no
Chromatic aberration:     [ ] yes  [x] no
Vignette pulse:           [x] yes  [ ] no
Particle burst:           [ ] yes  [x] no
Ambient glow pulse:       [x] yes  [ ] no
Hover lift + shadow:      [x] yes  [ ] no
Bloom on accents:         [x] yes  [ ] no
Film grain overlay:       [x] yes  [ ] no
Scanlines:                [ ] yes  [x] no
Impact pause:             [x] yes  [ ] no
Parallax on cursor:       [x] yes  [ ] no
Screen Effects Intensity: Subtle

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: “Control clean”, not cyberpunk noisy.
```

---

### Layer 09 — Sound Design
```
Sound Enabled:     [x] yes  [ ] no
UI Feedback:       [x] yes  [ ] no  — click, hover, toggle, error, success
Game State:        [x] yes  [ ] no  — unlock, level up, reward
Ambient Audio:     [x] yes  [ ] no  — per-skin room tone / low synth bed
Music / Stems:     [ ] yes  [x] no  — later
Sound Personality: Clean & precise + cinematic
Intensity:         Subtle

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Triggered by semantic events, not raw DOM clicks.
```

---

### Layer 10 — Personality & Archetype
```
Primary Archetype:    Ruler
Secondary Archetype:  Magician
Shadow (avoid):       Jester
Diegesis Level:       Stylistically diegetic
Voice Formality:      Semi-formal
Voice Warmth:         Cold / Neutral (warmth only on rewards)
POV:                  System / Operator

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Microcopy feels like an operator console.
```

---

### Layer 11 — Information Architecture
```
Navigation Model:    Hub-and-spoke (Lobby → Sections)
Max Depth:           3 clicks to any major function
Primary User Type:   Achiever
Secondary Types:     Explorer / Expert

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Lobby is the stable entry. Sections are locked.
```

---

### Layer 12 — State Machines
> Every screen and component needs: idle / loading / populated / empty / error states

```
Screens defined:    Lobby, Play, Profile, Lab, Inventory, Store, Multiplayer, Settings, Admin
Empty states:       [ ] designed for all data views
Error states:       [x] designed and actionable (rules defined)
Loading states:     [x] skeleton layouts defined (rules defined)

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Needs per-screen enumeration later.
```

---

### Layer 13 — Accessibility
```
WCAG Target:        AA
Keyboard Nav:       [x] all flows completable
Focus Rings:        [x] visible and styled
Reduced Motion:     [x] handled
Color Contrast:     [x] all text passes
ARIA Labels:        [x] all interactive elements

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Focus ring uses Accent Secondary (teal).
```

---

### Layer 14 — Performance
```
FPS Target:         60fps
Animation Rule:     GPU-safe only (transform + opacity)
Asset Loading:      [x] lazy loaded / [ ] preloaded
LCP Target:         < 2.5s

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Avoid layout thrash; overlays should be composited.
```

---

### Layer 15 — Failure States
```
Network error:      [x] designed
Validation error:   [x] inline, specific
Empty results:      [x] illustrated, with action
Permission denied:  [x] explained with path forward
Critical failure:   [x] branded error page

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Error visuals stay “in-world”. No generic SaaS banners.
```

---

### Layer 16 — Peak-End Rule
```
Peak moments defined:
  Onboarding peak:   first “quest accepted” + reward pulse + sound cue
  Achievement peak:  major unlock (new system/module) + cinematic overlay
  Discovery peak:    skin cue triggers scene/audio shift

End moments defined:
  Session end:       calm summary + next recommended quest
  Task complete end: confirmation + next step

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Needs exact UI moment definitions later.
```

---

### Layer 17 — Content & Microcopy
```
Voice:      precise, minimal, controlled
Tone:       neutral → sharp on alerts → celebratory on rewards
Register:   Semi-formal

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Short labels, uppercase headings, minimal punctuation.
```

---

### Layer 18 — Loading & Skeleton States
```
Skeleton layouts:   [x] match shape of real content
Shimmer animation:  [ ] yes  [x] no
Optimistic UI:      [x] yes

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Prefer subtle fade pulse rather than shimmer.
```

---

### Layer 19 — Onboarding
```
Arrival moment:      Lobby loads with “Station online” mood
First action:        accept first quest
Graduation moment:   user completes first loop and sees persistence
Skip option:         [x] yes  [ ] no

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Needs concrete steps + screens later.
```

---

### Layer 20 — User Types
```
Primary user:    Achiever
How served:      clear quests, progress, rewards, minimal friction
Power mode:      [x] available for Expert users

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Explorer and Expert get deep systems via Lab.
```

---

### Layer 21 — Physics & Motion Feel
```
Scroll momentum:    [x] yes  [ ] no
Spring physics:     [x] yes  [ ] no
Drag inertia:       [x] yes  [ ] no
Weight feel:        Heavy

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Heavy feel, controlled inertia, not playful.
```

---

### Layer 22 — Input Buffer
```
Button press during animation:   [x] buffered
Double-tap prevention:           [x] yes  [ ] no
Keyboard spam handling:          [x] yes  [ ] no

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Prevent accidental double actions on rapid input.
```

---

### Layer 23 — Context Preservation
> This file IS the context preservation system.
```
Project DNA file:   [x] exists (you are reading it)
Session log:        [x] maintained
Decisions log:      [x] maintained

Status: [ ] Missing  [ ] Partial  [x] Done
Notes: Always update QUICK READ + append logs.
```

---

### Layer 24 — Success Metrics
```
Task completion target:   85%
Error rate target:        < 2%
Performance target:       LCP < 2.5s, 60fps animations
Accessibility target:     WCAG AA

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Tune after MVP instrumentation.
```

---

### Layer 25 — Technical Stack
```
Output framework:   React (TypeScript) + Tailwind

Tier 1 (always included):
  [x] HTML5 + CSS Custom Properties
  [x] CSS Grid + Flexbox
  [x] CSS Animations
  [x] SVG

Tier 2 — Elevated:
  [ ] GSAP
  [x] Framer Motion
  [ ] tsParticles
  [ ] Lottie
  [x] Howler.js

Tier 3 — Game Level:
  [ ] Three.js
  [ ] GLSL Shaders
  [ ] Matter.js
  [ ] Tone.js
  [ ] PixiJS

Status: [ ] Missing  [x] Partial  [ ] Done
Notes: Use semantic-event layer to trigger motion/audio/scene cues.
```

---
---

## DECISIONS LOG
> AI appends here after every session. Newest first. One line per decision.
> Format: [Date] | [topic] | [what was decided]

[2026-03-11] | Visual Direction | Base skin is Control/Hitman-inspired: cinematic minimal, thin borders, small radius, inversion selection
[2026-03-11] | Token System | Colors defined as semantic tokens; skins override tokens, not structure
[2026-03-11] | Motion | Cinematic but responsive timing: 120/220/360/600ms, no bouncy motion
[2026-03-11] | Accent Colors | Primary red (#E0002A), secondary teal (#25D6C6)

---

## SESSION LOG
### Session 2 — 2026-03-11 — GPT-5.2 Thinking
Built:      Tightened tokens (typography/spacing/framing/motion/components) to measurable values; confirmed Control UI patterns from video frames.
Changed:    Status checkboxes now mean "pixel-spec defined" (not just directional).
Incomplete: Sound design remains directional (not asset list). Success metrics still TBD.
Next:       Fill State Machines + Onboarding flow for Lobby→Lab→Project→Work session; then lock Success Metrics.
Questions:  Do you want Accent Red always for selection, or only for danger + active selection?

> AI appends here after every session. Newest first.
> Format below — keep each entry concise.

### Session 1 — 2026-03-11 — GPT-5.2 Thinking
Built:      Filled PROJECT DNA base layer rules from concept + visual references (Control/Hitman)
Changed:    None (initial)
Incomplete: Per-screen state machines, onboarding details, user-type tuning, full metrics
Next:       Lock “Base Skin Pack v1” token JSON + component visuals/states
Questions:  Should secondary accent remain teal (system) or shift toward gold (rewards)?

---
*Template — SESSION ENTRY FORMAT (AI uses this structure):*
```
### Session [#] — [Date] — [AI name]
Built:      [what got completed]
Changed:    [anything that differs from spec, and why]
Incomplete: [what didn't get done]
Next:       [recommended priority for next session]
Questions:  [anything uncertain or unresolved]
```
