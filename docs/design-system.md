# UXDA design system (from UXDA Learn)

The visual language of UXDA Learn, written down so other projects and simple HTML pages and decks can use it.
Section 9 has a copy-paste starter for plain HTML. Section 10 covers Tailwind + shadcn projects.

Source of truth in this repo: `src/app/globals.css` (tokens, type scale, effects), `src/components/ui/*`
(shadcn components), and `DECISIONS.md` (the reasons). If this doc and `globals.css` disagree, `globals.css` is right.
Fix this doc to match.

---

## 1. Principles

- **Clean, calm, professional.** Plenty of space, few colours, light type at big sizes. No decoration for its own sake.
- **Dark by default.** The app opens in dark mode whatever the system setting is. Light mode is fully supported, and the
  visitor's choice is remembered.
- **One accent: lavender `#B5A2FF`.** Use it as a fill (buttons, CTA pills, focus rings, active states) with dark text
  on it. It is not a text colour on light backgrounds (see `brand-text`).
- **Soft neutrals.** No pure white page in light mode (`#fafafa`), no pure black or pure white in dark mode
  (`#101010` / `#e8e8e8`).
- **Every text/background pair passes WCAG AA** (4.5:1) in both themes. In UXDA Learn a unit test checks this
  (`src/lib/theme-contrast.test.ts`).
- **Colour is never the only signal.** Status, correct/incorrect, warnings and required items always come with an icon
  and a word.
- **Motion is short and soft**, and it collapses to a quick fade or to nothing under `prefers-reduced-motion`.

---

## 2. Colour

### Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#fafafa` | `#101010` | Page |
| `foreground` | `#18181b` | `#e8e8e8` | Body text, headings |
| `card` | `#ffffff` | `#1a1a1a` | Cards, panels |
| `card-foreground` | `#18181b` | `#e8e8e8` | |
| `popover` | `#ffffff` | `#212121` | Menus, dialogs, popovers |
| `popover-foreground` | `#18181b` | `#e8e8e8` | |
| `primary` | `#b5a2ff` | `#b5a2ff` | Lavender fill: main buttons, CTA pills, selected states |
| `primary-foreground` | `#241a3d` | `#241a3d` | Text on lavender (deep violet, never white) |
| `secondary` | `#f0f0f2` | `#2b2b2b` | Secondary buttons, neutral badges |
| `secondary-foreground` | `#18181b` | `#e8e8e8` | |
| `muted` | `#f0f0f2` | `#242424` | Quiet surfaces (tip box, draft cards) |
| `muted-foreground` | `#5f5f68` | `#a3a3a3` | Secondary text, descriptions, icons |
| `accent` | `#efebfb` | `#2c2740` | Hover background (a faint violet tint) |
| `accent-foreground` | `#18181b` | `#e8e8e8` | |
| `destructive` | `#c8102e` | `#f27474` | Errors, overdue, "changes requested" |
| `destructive-foreground` | `#ffffff` | `#101010` | Text on destructive fills |
| `success` | `#0b6b34` | `#6fd08c` | Correct answers, text colour only |
| `warning` | `#a14a00` | `#f0b44c` | Low scores, unfinished content, text colour only |
| `border` | `#e4e4e7` | `#303030` | Hairlines, card borders |
| `input` | `#d4d4d8` | `#3d3d3d` | Form field borders (dark: also field fill at 30%) |
| `ring` | `#b5a2ff` | `#b5a2ff` | Focus ring (used at 50% opacity) |
| `brand` | `#b5a2ff` | `#b5a2ff` | The raw brand lavender |
| `brand-text` | `#5b3fc9` | `#b5a2ff` | Lavender text (subheadings, eyebrows) |
| `tile` | `#ffffff` | `#0b0b0c` | Big feature/challenge card surface (darker than the page in dark mode) |
| `nav-track` | `#ececee` | `#161616` | Segmented control track |
| `nav-thumb` | `#ffffff` | `#282828` | Segmented control selected thumb |
| `nav-text` | `#27272a` | `#fafafa` | Segmented control labels (used at 70% idle, 90% hover) |
| `nav-text-active` | `#18181b` | `#ffffff` | Selected label |
| `skeleton` | `#ebebed` | `#262626` | Loading placeholders |
| `skeleton-shine` | `rgb(255 255 255 / .6)` | `rgb(255 255 255 / .05)` | Shimmer band |

### Rules

- **Lavender text needs its own token.** `#B5A2FF` on white is only 2.3:1. On light backgrounds, lavender text uses
  `brand-text` (`#5b3fc9`). On dark backgrounds the brand lavender itself works.
- **Text on lavender is deep violet `#241a3d`**, never white. That holds in both themes.
- **Dark surfaces are neutral greys that step up in lightness**, with no colour cast:
  `#101010` page → `#1a1a1a` card → `#212121` popover → `#242424` muted → `#2b2b2b` secondary → `#3d3d3d` input.
  Only `accent` (`#2c2740`) carries a violet tint. The one exception is `tile` (`#0b0b0c`), which sits *below* the
  page so feature cards read as deep panels.
- **`success` and `warning` are text colours**, chosen to pass AA on background, card, muted and accent. Don't use them
  as large fills.
- **Hover** = `primary` at 90% for lavender buttons, `secondary` at 80% for secondary ones, and the `accent`
  background for ghost/outline buttons and menu items (50% in dark mode).

### Decorative colour (brand moments only)

| Name | Value | Where |
|---|---|---|
| Aurora stops | `#00fff8 → #7438fb → #1d0093` | Animated glow behind the home hero |
| Violet glow | `radial-gradient(closest-side, rgb(128 48 255 / .24), rgb(89 39 232 / .1) 55%, transparent)` | Behind the glass login card |
| Glass X stage | `#17181C` (X rendered on black, `mix-blend-mode: screen`) | Login and loader |

---

## 3. Typography

### Typeface

- **Urbanist**, a geometric sans, as one variable font (weights 100–900). Fallback: `ui-sans-serif, system-ui, sans-serif`.
- **Code:** system monospace (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`). Urbanist has no mono companion.
- **Latvian names (important):** Google Fonts' Urbanist draws the macron of ā ē ī ū one letter too far right, and Urbanist
  has no lowercase ģ. UXDA Learn self-hosts the full original variable font (`src/app/fonts/Urbanist-Variable.woff2`)
  and adds Outfit's ģ for U+0123 only (`Outfit-gcommaaccent.woff2`, listed *first* in the font stack with
  `unicode-range: U+0123`). For English-only decks the Google Fonts version is fine. For anything that shows team
  names, copy those two font files (both SIL OFL).

### Scale

Every step is 2px larger than Tailwind's default, which reads better in Urbanist. Body text is 18px.

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16px | Badges only |
| `text-meta` | 14 / 20px | Meta info (points, difficulty, time), table headers, captions, section labels, nav labels |
| `text-sm` | 16 / 24px | Buttons, secondary paragraphs, descriptions, form fields (desktop) |
| `text-base` | 18 / 28px | **Body** |
| `text-lg` | 20 / 30px | Lead paragraphs |
| `text-xl` | 22 / 30px | Small headings |
| `text-2xl` | 26 / 34px | Page titles, card headings (mobile) |
| `text-3xl` | 32 / 40px | Card headings (desktop), hero headline (mobile) |
| `text-4xl` | 38 / 44px | Large headings |
| `text-5xl` | 48px, line height 1 | Hero headline (desktop) |
| `text-7xl` / `text-9xl` | 72px / 128px, line height 1 | Hero numbers (points), mobile / desktop |

### Habits

- **Display type is light.** Hero headlines, card headings and big numbers are `font-weight: 300` with
  `letter-spacing: -0.025em` (tracking-tight). Numbers also get `font-variant-numeric: tabular-nums`.
- **Page titles** are 26px, weight 600, tracking-tight.
- **Labels and buttons** are weight 500. Bold is reserved for emphasis inside prose.
- **Section labels** ("Total points", "Categories") are 14px at 80% foreground opacity. They are quiet and never uppercase.
- **Lavender subheading** under a light heading: `brand-text`, weight 500, at most 2 lines.
- **Muted body** under that: `muted-foreground`, at most 3 lines on cards.

---

## 4. Shape, space, elevation

**Radius.** Base `--radius: 0.625rem` (10px).

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 6px | Small inner elements |
| `rounded-md` | 8px | Inputs, selects |
| `rounded-lg` | 10px | Tip boxes, empty states, alerts |
| `rounded-xl` | 14px | Standard cards, dialogs |
| `24px` / `32px` | mobile / ≥640px | Big feature (tile) cards |
| `rounded-full` | pill | **All buttons**, badges, segmented nav, CTA pills |

Pills and soft corners everywhere. Nothing is square.

**Layout.**
- Content widths: `72rem` (1152px) for wide pages with grids, `64rem` (1024px) for standard pages, `48rem` (768px)
  for reading pages and forms, `28rem` (448px) for centred states (errors, sign-in).
- Side gutter: 16px. The header goes full width with 16 → 24 → 40 → 80px side padding (phone → desktop).
- Page vertical padding: 40px. Page header to content: 32px. Card grid gap: 16px.
- Feature card grid: 12 columns on desktop, alternating wide (7) and narrow (5) cards, one column on mobile.
  A lone last card spans the full row.
- Header height: 56px.

**Elevation.** Very little shadow. Depth comes from surface steps and 1px borders.
- Buttons, inputs: `0 1px 2px rgb(0 0 0 / .05)`.
- Cards: `0 1px 3px rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1)`.
- Feature tiles: border only, no shadow. The border turns `primary` on hover.

**Icons.** [Lucide](https://lucide.dev): 16px in buttons and text rows, 12px inside badges, 32px in empty
states. Stroke icons only, coloured with `currentColor` or `muted-foreground`. Decorative icons get `aria-hidden`.

---

## 5. Components

Specs are given in plain terms; the Tailwind classes are in the source files named.

### Button (`ui/button.tsx`)
- Pill (`rounded-full`), weight 500, 16px text, 8px gap to a 16px icon.
- Sizes: **sm** 32px high, 14px side padding · **default** 36px, 16px · **lg** 40px, 24px · **icon** 36×36.
- Variants:
  - **default**: lavender fill, `#241a3d` text, hover 90%.
  - **secondary**: `secondary` fill.
  - **outline**: 1px border on `background`, accent on hover. In dark mode the fill is `input` at 30%.
  - **ghost**: no fill, accent on hover.
  - **destructive**: `destructive` fill with `destructive-foreground` text.
  - **link**: plain text, underline on hover.
- Disabled: 50% opacity, no pointer events. Loading: spinner icon plus a verb ("Saving…"), and the button is disabled.

### Badge (`ui/badge.tsx`)
- Pill, 12px weight 500, 8px × 2px padding, 12px icon, 4px gap.
- Status mapping (always icon + word): not started = outline + circle · waiting = secondary + clock ·
  done = lavender + check-circle · action needed = destructive + rotate-ccw · in progress = secondary + pencil.

### Card (`ui/card.tsx`)
- `card` surface, 1px border, 14px radius, card shadow, 24px padding, 24px gap between header / content / footer.
- Title weight 600. Description 16px muted.

### Feature tile (`challenge-card.tsx`)
The signature card. Use it for anything that is "a thing to open": a challenge, a path, a project, a slide topic.
- `tile` surface, 1px border, 24px radius (32px ≥640px), padding 24px (32px ≥640px), min height 256px.
- Contents in order: big **light heading** (26 → 32px, weight 300, tracking-tight, tight leading), a **lavender
  subheading** (`brand-text`, 500), a **muted body** (max 3 lines), then at the bottom a **lavender CTA pill** (40px
  high, 20px padding, label + arrow-right) and a meta row (14px) with badges.
- Hover: the border turns `primary` and the arrow moves 2px right. The whole card is one link.
- Optional artwork sits flush in the bottom-right corner as a true background. It never moves the text. On wide
  cards the text keeps to 60–70% of the width.
- Draft/unpublished variant: dashed border at 50% muted-foreground, `muted` surface.

### Form fields (`ui/input.tsx`, `textarea`, `select`)
- 36px high, 8px radius, 1px `input` border, transparent fill (dark: `input` at 30%), 12px side padding.
- Text 18px on mobile and 16px from 768px. Placeholder in `muted-foreground`.
- Focus: border turns `ring` plus a 3px lavender ring at 50%. Invalid: `destructive` border plus a 3px destructive ring at 20%.

### Focus ring (everything interactive)
`outline: none; box-shadow: 0 0 0 3px rgb(181 162 255 / .5)`. Shown on `:focus-visible` only.

### Segmented nav (`rubber-nav/RubberNav.css`)
- `nav-track` pill, 36px high, 24px radius, 3px inset. A `nav-thumb` pill (21px radius) slides under the active item.
- Labels 14px at 70% opacity (90% on hover). The active label is `nav-text-active`.
- Items share equal widths, with a minimum 24px touch target on the smallest phones.
- The same thumb/track tokens are reused for filter pills, so all "pick one" controls look alike.

### Sticky header (`site-header.tsx`, `.site-header` in `globals.css`)
- 56px, full width. Three columns: logo left, nav in the true centre, actions right.
- Transparent at the top of the page. Once content scrolls under it, the background becomes the page colour at 72%,
  with `backdrop-filter: blur(16px) saturate(1.5)` and a 1px `border` hairline. Transition 250ms.

### Tip box (`tip-box.tsx`)
`muted` at 40%, 1px border, 10px radius, 16px × 12px padding, lightbulb icon, 16px muted text, links and bold in full
foreground.

### Empty state (`empty-state.tsx`)
1px **dashed** border, 10px radius, 24px × 48px padding, centred. A 32px muted icon, a title in weight 500, and one
muted line (max 24rem wide). Optionally a button. Every list has one.

### Glass card (`.glass-card` in `globals.css`)
For dark brand moments only (login), over the violet glow.
```css
background: linear-gradient(180deg, rgb(255 255 255 / .1), rgb(255 255 255 / .05));
backdrop-filter: blur(22px) saturate(1.4);
border: 1px solid rgb(255 255 255 / .16);
box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), 0 24px 60px -24px rgb(0 0 0 / .7), 0 2px 8px rgb(0 0 0 / .25);
/* no backdrop-filter support: background: rgb(36 36 40 / .94) */
```

### Skeleton (loading)
`skeleton` fill in the shape of the real content, with one soft `skeleton-shine` band sweeping across the whole
viewport every 2.8s. All skeletons share one sweep so they stay in sync. Under reduced motion they are static grey.

### Page header (`page-header.tsx`)
Title (26px, 600, tracking-tight), an optional 16px subtitle at 80%, an optional muted description, and actions on
the right (stacked under the title on phones). 32px below.

---

## 6. Motion

- **One easing for entrances:** `cubic-bezier(0.23, 1, 0.32, 1)` (a fast start with a long soft settle). Use
  `ease` or `ease-in-out` for fades and colour changes.
- **Page entry** (on client navigation, not on first load): each top-level block fades in, rises 8px and unblurs 4px
  over 300ms, staggered 35ms, with at most 6 staggered blocks. Anything below the fold just appears.
- **Hover/colour transitions:** about 150–250ms.
- **Card reveal (login):** 500ms, from `translateY(12px) scale(.98)` and 0 opacity.
- **Numbers** count up once per session. The final number is always in the HTML.
- **Reduced motion:** no movement. A ≤150ms fade or nothing. The glass X shows as a still image.
- Nothing loops except the aurora and the skeleton sweep, and the sweep only runs while something is loading.

---

## 7. Brand moments (use sparingly)

- **Glass X.** The UXDA X as real-time 3D glass (WebGL / three.js) that turns in, sweeps violet-blue-cyan light and
  settles as dark glass with a glowing violet outline. A standalone, embeddable copy is in `design-assets/web-x/`
  (see its README: `mountGlassX(el, { background: '#000' })`). Use it for title slides and sign-in screens.
- **Aurora.** A slow animated glow (`#00fff8 → #7438fb → #1d0093`) rising from the bottom edge behind a hero. Text never
  sits on its brightest band; bare text over it gets a scrim of the page colour at 85%.
- **Violet glow** behind glass surfaces.
- One brand moment per screen. Everything else stays flat and calm.

---

## 8. Accessibility checklist

- Every text/background pair is ≥4.5:1 in both themes (≥3:1 for large display type and UI borders that carry meaning).
- Colour is never the only signal: use an icon plus a word.
- Touch targets are ≥24px (36px for buttons by default).
- Use real headings in order. A card title is a heading, not a styled div.
- One link per card (the title, stretched over the card). The CTA pill inside it is decoration.
- Add a "Skip to content" link as the first focusable element.
- Every async action has a loading state and an error state. Every list has an empty state.
- Decorative canvases and icons get `aria-hidden`. Every image has alt text.
- Respect `prefers-reduced-motion`.

---

## 9. Starter kit: plain HTML pages and presentations

Paste this into a single `.html` file. It is dark by default. Put `data-theme="light"` on `<html>` for light.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UXDA deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@100..900&display=swap" rel="stylesheet">
<style>
  /* ---- Tokens (dark default) ---- */
  :root {
    --background: #101010; --foreground: #e8e8e8;
    --card: #1a1a1a; --popover: #212121; --tile: #0b0b0c;
    --primary: #b5a2ff; --primary-foreground: #241a3d;
    --secondary: #2b2b2b; --muted: #242424; --muted-foreground: #a3a3a3;
    --accent: #2c2740; --brand-text: #b5a2ff;
    --destructive: #f27474; --success: #6fd08c; --warning: #f0b44c;
    --border: #303030; --input: #3d3d3d; --ring: rgb(181 162 255 / .5);
    --radius: 10px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --font: Urbanist, ui-sans-serif, system-ui, sans-serif;
    color-scheme: dark;
  }
  :root[data-theme="light"] {
    --background: #fafafa; --foreground: #18181b;
    --card: #ffffff; --popover: #ffffff; --tile: #ffffff;
    --secondary: #f0f0f2; --muted: #f0f0f2; --muted-foreground: #5f5f68;
    --accent: #efebfb; --brand-text: #5b3fc9;
    --destructive: #c8102e; --success: #0b6b34; --warning: #a14a00;
    --border: #e4e4e7; --input: #d4d4d8;
    color-scheme: light;
  }

  /* ---- Base ---- */
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; background: var(--background); color: var(--foreground);
    font-family: var(--font); font-size: 18px; line-height: 28px;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { margin: 0; letter-spacing: -0.025em; }
  p { margin: 0; }
  .display { font-size: clamp(32px, 6vw, 72px); line-height: 1.05; font-weight: 300; letter-spacing: -0.025em; }
  .title   { font-size: 26px; line-height: 34px; font-weight: 600; }
  .heading { font-size: 32px; line-height: 1.2; font-weight: 300; }
  .eyebrow { color: var(--brand-text); font-weight: 500; }
  .lead    { font-size: 20px; line-height: 30px; color: var(--muted-foreground); }
  .muted   { color: var(--muted-foreground); }
  .meta    { font-size: 14px; line-height: 20px; color: color-mix(in oklab, var(--foreground) 80%, transparent); }
  .stat    { font-size: clamp(72px, 12vw, 128px); line-height: 1; font-weight: 300; letter-spacing: -0.025em;
             font-variant-numeric: tabular-nums; }

  /* ---- Components ---- */
  .btn {
    display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 20px;
    border-radius: 999px; border: 1px solid transparent; font: 500 16px/1 var(--font);
    background: var(--primary); color: var(--primary-foreground); text-decoration: none; cursor: pointer;
    transition: background-color 150ms ease;
  }
  .btn:hover { background: color-mix(in oklab, var(--primary) 90%, transparent); }
  .btn--outline { background: transparent; color: var(--foreground); border-color: var(--input); }
  .btn--outline:hover { background: var(--accent); }
  .btn:focus-visible, a:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

  .badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
    font-size: 12px; line-height: 16px; font-weight: 500;
    background: var(--secondary); color: var(--foreground);
  }
  .badge--brand { background: var(--primary); color: var(--primary-foreground); }

  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px;
    box-shadow: 0 1px 3px rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1);
  }
  .tile {
    display: flex; flex-direction: column; gap: 16px; min-height: 256px; padding: 32px;
    background: var(--tile); border: 1px solid var(--border); border-radius: 32px;
    transition: border-color 150ms ease;
  }
  .tile:hover { border-color: var(--primary); }
  .tip {
    display: flex; gap: 12px; padding: 12px 16px; border-radius: var(--radius); border: 1px solid var(--border);
    background: color-mix(in oklab, var(--muted) 40%, transparent); color: var(--muted-foreground); font-size: 16px;
  }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }

  /* ---- Slides: full-screen sections, scroll or arrow keys ---- */
  html:has(.deck) { scroll-snap-type: y mandatory; }
  .slide {
    min-height: 100vh; scroll-snap-align: start; display: flex; flex-direction: column; justify-content: center;
    gap: 24px; padding: 64px max(16px, 8vw); max-width: 1440px; margin: 0 auto;
  }
  .slide > * { animation: rise 500ms var(--ease-out) both; }
  .slide > *:nth-child(2) { animation-delay: 35ms; }
  .slide > *:nth-child(3) { animation-delay: 70ms; }
  .slide > *:nth-child(n+4) { animation-delay: 105ms; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } }
  @media (prefers-reduced-motion: reduce) { .slide > * { animation: none; } }
</style>
</head>
<body>
<main class="deck">
  <section class="slide">
    <p class="eyebrow">UXDA · October 2026</p>
    <h1 class="display">A calm title in light type</h1>
    <p class="lead" style="max-width: 40ch">One short muted line that says what this deck is about.</p>
  </section>

  <section class="slide">
    <p class="meta">Total points</p>
    <p class="stat">1,240</p>
    <p class="muted">Big numbers are light, tight and tabular.</p>
  </section>

  <section class="slide">
    <h2 class="title">Three things</h2>
    <div class="grid">
      <article class="tile">
        <h3 class="heading">First topic</h3>
        <p class="eyebrow">Lavender subheading</p>
        <p class="muted">Muted body text, two or three lines at most.</p>
        <span class="btn" style="margin-top:auto; width:fit-content">Open →</span>
      </article>
      <article class="tile"><h3 class="heading">Second</h3><p class="eyebrow">Subheading</p><p class="muted">Body.</p></article>
      <article class="tile"><h3 class="heading">Third</h3><p class="eyebrow">Subheading</p><p class="muted">Body.</p></article>
    </div>
    <div class="tip">💡 <span>A tip box for an aside or a speaker note.</span></div>
  </section>
</main>
</body>
</html>
```

Slide patterns that fit the system:
- **Title slide:** eyebrow + `display` headline + one `lead` line. Optionally the glass X (section 7) on the right.
- **Big number:** `meta` label above a `stat`, one muted line under it.
- **Topics:** a `title` and a grid of 2–4 `tile`s.
- **Content:** `title`, then reading-width text (max ~65 characters per line), with a `card` or `tip` for asides.
- Use one lavender element per slide (a button, a badge or an eyebrow) so the accent stays an accent.

---

## 10. Using it in a Tailwind + shadcn project

1. Tailwind v4 + `tw-animate-css` + `@tailwindcss/typography`.
2. shadcn/ui, style **new-york**, base colour **neutral**, CSS variables on, icon library **lucide**.
3. Copy from `src/app/globals.css`: the `@custom-variant dark`, the `@theme` type scale, the `@theme inline` colour
   and radius mapping, and the `:root` / `.dark` token blocks. Take the skeleton, `.site-header` and `.glass-card`
   blocks if you need them.
4. Override the shadcn defaults the way `src/components/ui/button.tsx` and `badge.tsx` do: `rounded-full` buttons and
   `destructive-foreground` instead of `text-white`.
5. If you use `tailwind-merge`, teach it that `text-meta` is a font size. Otherwise `cn("text-meta", "text-foreground")`
   drops one of them.
6. `next-themes` with `attribute="class"`, `defaultTheme="dark"` and `enableSystem={false}`.
7. Fonts: `next/font/local` with the two files from `src/app/fonts/` (see `src/app/layout.tsx`).
