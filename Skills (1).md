# SARAS UX Standard & Component Library

**Single source of truth for UX across all SARAS products and applications.**

This document defines the design foundations, component library, app-shell patterns,
accessibility requirements, and motion/content rules that every SARAS product must follow.
It is derived verbatim from the shipping reporting-console application
(`react-app/v3/src/**`) and is written to be implementable in any product, framework, or
platform — the tokens and rules are portable; only the code snippets are React examples.

> **How to use this document**
> 1. Adopt the **Foundations** (§1) as design tokens — colors, type, spacing, radii,
>    shadows. Never hardcode values outside these tokens.
> 2. Build UI only from the **Component Library** (§2). If a pattern isn't here, propose
>    it as an addition rather than inventing a one-off.
> 3. Follow the **App Shell** (§3) for any multi-screen product.
> 4. **Accessibility** (§4) is mandatory, not optional — every rule is a merge gate.
> 5. Apply **Motion & Content** (§5) for polish and consistency.
>
> Status: P1 Foundations ✅ · P2 Components ✅ · P3 Shell ✅ · P4 Accessibility ✅ · P5 Motion/Content ✅ — COMPLETE

---

## 1. Foundations

### 1.1 Color palette

Every color in the product comes from this table. No ad-hoc hex values. When a new hue is
unavoidable, derive it with `oklch()` from the primary blue so it stays harmonious.

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#0070E0` | Buttons, links, active nav, focus rings, selected chips |
| `--primary-hover` | `#005BB8` | Button/link hover |
| `--primary-tint` | `#EAF3FE` | Icon tiles, selected backgrounds, count pills |
| `--primary-tint-2` | `#F4F9FF` | Card header strips, subtle panels |
| `--ink` | `#1A1E26` | Primary text, headings |
| `--ink-alt` | `#1A2740` | Dense headings, table headers |
| `--muted` | `#5A6675` | Secondary text, meta, labels |
| `--border` | `#E4E9F0` | Default card/table borders, dividers |
| `--border-blue` | `#DCE7F5` | Emphasized card borders, footers |
| `--surface` | `#FFFFFF` | Cards, modals, panels |
| `--surface-alt` | `#FBFCFD` | Scroll areas, page sections |
| `--surface-page` | `#F5F7FA` | App background |
| `--success` | `#16A34A` | Saved ticks, Excel icon, badge/icon FILLS (non-text only) |
| `--success-text` | `#0E7A36` | Green TEXT — badge labels, positive trend copy (5.4:1 white / 4.9:1 tint) |
| `--danger` | `#DC2626` | Destructive hover, error text/icons (4.8:1 on white — text-safe) |
| `--warning` | `#F59E0B` | Pending/attention badge/icon FILLS (non-text only) |
| `--warning-text` | `#8A5200` | Amber TEXT — badge labels, attention copy (6.4:1 white / 6.0:1 tint) |
| `--on-tint-blue` | `#005BB8` | Blue TEXT/initials on `--primary-tint` (6.0:1 — never plain `--primary`) |

**Rules**
- One accent language (blue tint) across all cards — no saturated gradient banners.
- **Status hues (`--success`, `--warning`) are FILL/ICON accents, never text.** Any green or
  amber *text* — including badge labels and trend copy — uses `--success-text` / `--warning-text`,
  which are pre-darkened to clear 4.5:1 on both white AND their tinted badge backgrounds.
  (The bright hues at text size fail: `#16A34A` = 3.3:1, `#F59E0B` = 1.9:1 on white.)
- **Never place `#0070E0` text on any blue tint** — this includes avatar/monogram initials,
  count-pill numbers, and chips. Options that pass: white text on solid `--primary`
  (4.6:1, keep weight ≥600), or `--on-tint-blue` `#005BB8` text on `--primary-tint` (6.0:1).
  Avatar initials are decorative (`aria-hidden`) but audits still score them — treat them
  as real text for contrast.
- Any new tinted-background + accent-text pairing must be verified at BOTH ends: the darkest
  the text can go and the lightest the tint can go. If it fails, darken the *-text* token; never
  lighten the tint to force a pass.
- Never a black border on hover (a real bug — see §2.1); change border *color*, not the
  `border` shorthand, in hover handlers.
- **Never use opacity modifiers on text** (e.g. `text-muted-foreground/60`). Always use a
  full semantic token: `--ink`, `--muted`. Opacity on text is unpredictable against
  varied backgrounds and usually breaks contrast.

### 1.2 Typography

Font: **Poppins** (Google Fonts), fallback `system-ui, sans-serif`.

| Role | Size / weight |
|---|---|
| Page title (single `<h1>`) | 20–22px / 600 |
| Section heading | 16–18px / 600 |
| Card title | 15–16px / 600 |
| Section label / eyebrow | 11–12px / 600, letter-spacing .04em, `--muted`, uppercase |
| Body | 13.5–14px / 400–500 |
| Meta / helper | 12–12.5px / 400, `--muted` |
| Table header | 12.5px / 600, `--ink-alt` |
| Button | 13.5–14px / 600 |

**Minimums:** no text below 12px anywhere in product UI. Heading levels never skip
(h1 → h2 → h3). Exactly one `<h1>` per page; use `<span>` for logos/branding in the header.

### 1.3 Spacing scale

`4 / 8 / 12 / 14 / 16 / 20 / 24` px. Card padding 14–20px. Lay out sibling groups with
flex/grid `gap` (10–16px), never per-element margins or whitespace-spaced inline siblings —
gap survives drag-reorder / delete / duplicate. Compact density is preferred; minimize
vertical space.

### 1.4 Radii

| Element | Radius |
|---|---|
| Cards, panels | 14–16px |
| Buttons, inputs, dropdowns | 10px |
| Chips / pills | 999px |
| Icon tiles | 8–10px |

### 1.5 Shadows

| Use | Value |
|---|---|
| Card resting | `0 4px 16px -8px rgba(16,42,84,.12)` |
| Card hover lift | `0 8px 24px -10px rgba(16,42,84,.18)` |
| Primary button hover | `0 6px 16px -6px rgba(0,112,224,.45)` |
| Popover / modal | `0 12px 32px -12px rgba(16,42,84,.25)` |
| Scroll area edges | inset top + bottom shadows on `--surface-alt` |

---

## 2. Component Library

### 2.0 Shared code inventory (single implementation, reused everywhere)

Every console is built from the same small set of shared primitives. Reuse these; never
re-implement a native `<select>`, a bespoke button, or a one-off pager.

| File | Exports | Purpose |
|---|---|---|
| `lib/css.js` | `css(str)`, `merge(...)` | CSS string → React style object. **Expands every `border` shorthand into longhands** so React diffs like-for-like across renders — this is the fix for the "black border after hover" bug. Always route inline styles through it. |
| `Dropdown.jsx` | `default Dropdown` | Custom dropdown (not native `<select>`): label + trigger + **portal menu** so it never clips inside overflow/modals. Auto search box when >7 options, single or `multi`, `error`/`disabled` states, check on selected. |
| `Pager.jsx` | `default Pager`, `pageWindow()` | Windowed pagination footer (first · … · window · … · last) + `pageWindow(total,page,size)` slice helper. Every report table uses it. |
| `formKit.jsx` | `TextField`, `Overlay`, `CloseBtn`, `PrimaryBtn`, `GhostBtn`, `IconBtn`, `OutlineBtn`, `AddBtn`, `CheckBox`, `CheckBoxBox`, `EmptyState` | Buttons, labeled input, modal overlay, checkboxes, animated empty state. Shared hover+press `useFx` behavior. |
| `icons.jsx` | icon set | Single stroke-icon source (2px, round caps). No ad-hoc SVGs per screen. |
| `consoleUtils.js` | `toast(...)` etc. | Toast + shared helpers. |
| `ChartTip` | (per chart) | Dark rounded chart hover tooltip. |
| `reportWindow.js` | report opener | Report PDFs open in a **new window** via a same-origin blob (raw path 401s). |

> Every primitive is **portal-mounted** where it floats (dropdown menu, overlay, popover)
> so ancestor `overflow`/`transform`/stacking never clips or traps it.

### 2.1 Cards

White surface, radius 14–16px, border `--border` (emphasized `--border-blue`), resting
shadow. Optional header strip: tinted gradient (`--primary-tint-2`) + 28px icon tile
(`--primary-tint`, blue icon). **Report lists are cards, not tables** — 3 per row on web,
responsive to 1. Card title turns `--primary` on hover; hover raises the lift shadow.
**Never a black border on hover** — change border *color* only (see `css.js`).

### 2.2 Buttons (`formKit.jsx`)

| Variant | Export | Spec |
|---|---|---|
| Primary | `PrimaryBtn` / `AddBtn` | 46px, blue gradient `linear-gradient(180deg,#1a86f0,#0070E0)`, white 500 text, radius 11px; hover lift + soft blue shadow; active scale .97. Disabled `#B9C4D4`, not-allowed. |
| Secondary / ghost | `GhostBtn` / `OutlineBtn` | White, border `--border-blue`, ink text; hover blue-tint bg + lift. `OutlineBtn` adds a leading icon. |
| Icon | `IconBtn` | 32px square, radius 8px, tint bg + configurable hover color; **requires `label`** (→ `aria-label`). |
| Close | `CloseBtn` | 32px, X rotates 90° on hover; `aria-label="Close"`. |

Excel export = green Excel-sheet SVG (folded corner + white X). All buttons share `useFx`
hover/press; press = scale-down, hover = `translateY(-1.5px)` + shadow.

### 2.3 Inputs & dropdowns

- **`TextField`**: 44px, radius 10px, 1.5px border `#D5DBE4`; focus ring
  `border-color:#0070E0` + `0 0 0 3px rgba(0,112,224,.14)`; error ring red + `role="alert"`
  message; label 14px/500 above; optional hint 11.5px muted.
- **`Dropdown`**: 44px trigger, chevron rotates 180° open, **portal menu** with `popIn`
  animation, auto-search over 7 options, active (non-default) state = blue tint bg + blue
  text + blue border, `multi` mode with checkboxes, `disabled` shows a lock. Menu flips
  above when there's no room below.
- **Class & Section are always two separate dropdowns**; Section options are scoped to the
  chosen Class and reset when Class changes.
- Stepper input (e.g. Duration): 44px, leading icon, numeric, unit suffix, ± chevrons.

### 2.4 Chips, pills, badges

Filter chips 32px, radius 999px; selected = solid `--primary` white pill (with count),
unselected = white + border. Count pills: solid blue, or `--primary-tint` with `--on-tint-blue`
text (never plain `--primary` on the tint). Status badges: tinted bg + the matching *-text*
token (`--success-text` / `--warning-text` / ink), 12px/600 — always paired with an icon/label,
never color alone. Badge text NEVER uses the raw `--success` / `--warning` fill hues.

### 2.5 Tables & pagination (`Pager.jsx`)

Header row 12.5px/600 `--ink-alt` on `--surface-alt`, real `<th scope>`; rows 13.5px,
divider `--border`, row-hover tint; numbers right-aligned, tabular-nums. Expandable rows:
chevron toggle → sub-type cards / detail panel (toggles on Enter/Space). Every report table
paginates via `Pager` + `pageWindow()`; page buttons labelled, optional page-size dropdown.
`EmptyState` (animated) renders when a table has no rows — never a blank area.

### 2.6 Modals & popovers (`Overlay`)

`Overlay` portals to `<body>`, dim `rgba(20,30,50,.42)` + 2px blur, `fadeUp` in. Modal:
white, radius 16px, popover shadow; title 16px/600 with `CloseBtn`; footer right-aligned
`GhostBtn` Cancel + `PrimaryBtn` CTA; inline required-field validation. Popovers/menus:
radius 12px, same shadow; header z-index 60 > sticky filter bars (z 30) > dropdown/overlay
portals (z 1200–4000).

### 2.7 Steppers & progress

Step-indicator card: numbered circles (done = green tick), connector line, active step blue.
Footer stepper card (`--border-blue`): Previous left, actions right, buttons flex-wrap so
the footer never overflows.

---

## 3. App Shell & Responsiveness

### 3.1 Header

64px fixed, white surface, bottom border `--border`, **z-index 60** (always above sticky
filter bars at z 30 and page content). Semantic `<header>` — no redundant `role="banner"`.
Left: logo (a `<span>`, never an `<h1>`) + console/product name. Right: role/profile
popover and logout, both portal-mounted so they escape the header's stacking context.

### 3.2 Side navigation

Blue gradient rail, `<nav aria-label="Main navigation">`: **92px collapsed / 236px
expanded**, `.28s` width transition. Nav items are pill states — active = white/tint pill +
blue icon; hover = translucent white overlay. The collapsed rail shows icons only, with
flyout labels on hover; sub-menus open as flyout panels. On mobile the rail becomes a drawer
overlay (see §3.4). Every nav item is a real focusable control in DOM order.

### 3.3 Content area

Page background `--surface-page`; content width fluid with 20–24px gutters. Wrap the main
region in `<main>` (no redundant `role="main"`) and provide a **skip-to-main-content** link
as the first focusable element. Page-title row: single `<h1>` + breadcrumb/back on the left,
actions on the right. Sticky filter bars allowed at z 30 (under the header).

### 3.4 Breakpoints & responsive rules

| Range | Behavior |
|---|---|
| ≥ 1440px | 3 report cards/row; two-pane layouts side by side |
| 1100–1439px | 2–3 cards/row; side panels use `clamp()` widths (e.g. `clamp(340px,44%,560px)`) |
| ≤ 1100px | Two-pane layouts stack to one column; side panels go static full-width |
| ≤ 768px | 1 card/row; nav rail → mobile drawer overlay; tables scroll horizontally or collapse to cards |

Collapsible panels animate `grid-template-columns` / width; collapsed = 56px vertical rail
(icon tile, count pill, vertical label, chevron). Button rows `flex-wrap` so footers never
overflow. Always lay out with grid/flex `gap` — never margin-spaced inline siblings.

---

## 4. Accessibility Standards (WCAG 2.2 Level AA)

Every rule below is a **merge gate**, not a suggestion. It applies to all SARAS products
regardless of framework.

### 4.1 Color & contrast

- **NEVER use opacity modifiers on text** (e.g. `text-muted-foreground/60`). Always use full
  semantic tokens: `--ink` (`text-foreground`), `--muted` (`text-muted-foreground`).
- All text meets **4.5:1** contrast against its background. Decorative / non-text elements
  meet **3:1**.
- Measured against the SARAS palette:

  | Pair | Ratio | Verdict |
  |---|---|---|
  | Ink `#1A1E26` on white | 15.9:1 | AAA |
  | Muted `#5A6675` on white | 5.9:1 | AA (all sizes) |
  | Primary `#0070E0` on white | 4.6:1 | AA — links/text ≥13.5px |
  | White on Primary `#0070E0` | 4.6:1 | AA — button text stays ≥600 weight |
  | White on `#005BB8` (hover) | 6.3:1 | AA |
  | `#0070E0` on `--primary-tint` `#EAF3FE` | 4.3:1 | ✗ FAILS — never use (avatars, pills, chips) |
  | `--on-tint-blue` `#005BB8` on `--primary-tint` | 6.0:1 | AA — use for text/initials on blue tint |
  | `--success` `#16A34A` text on white | 3.3:1 | ✗ FAILS — fill/icon only |
  | `--success-text` `#0E7A36` on white / green tint | 5.4:1 / 4.9:1 | AA — all green text |
  | `--warning` `#F59E0B` text on white | 1.9:1 | ✗ FAILS — fill/icon only |
  | `--warning-text` `#8A5200` on white / amber tint | 6.4:1 / 6.0:1 | AA — all amber text |

  Status hues are fills/icons only — green/amber TEXT uses the `-text` tokens (see §1.1).
  Never place `#0070E0` text on tinted blue backgrounds (use `--on-tint-blue`); muted text never below 12px.
  Disabled elements are exempt but still ≥45% opacity for legibility. **Never convey status
  by color alone** — pair with an icon or text label (green tick + "Saved").

### 4.2 Buttons & interactive elements

- Every `<button>` without visible text MUST have `aria-label="descriptive action"`
  (`IconBtn`/`CloseBtn` in `formKit.jsx` require the `label` prop).
- Clickable `<div>`s must have `role="button"`, `tabIndex={0}`, and `onKeyDown` handling for
  Enter/Space.
- Never use `role="link"` on elements that aren't `<a>` tags navigating via `href` — use
  `role="button"` instead.

### 4.3 Icons & decorative elements

- All decorative icons: `aria-hidden="true" focusable="false"`.
- Decorative images: `role="presentation"` or `alt=""`.
- Decorative separators/dividers: `aria-hidden="true"`.

### 4.4 Forms & inputs

- Every `<input>`, `<select>`, `<textarea>` MUST have a visible `<label>` or `aria-label`;
  bind labels programmatically (`htmlFor`/`id`).
- For any custom or shadcn `<SelectTrigger>` (our `Dropdown` trigger), always add
  `aria-label="..."`, plus `aria-expanded` + `aria-haspopup="listbox"`; the menu is
  `role="listbox"` with `option` + `aria-selected`.
- Required fields marked in the label **and** validated inline with text (not color-only);
  error text 12.5px `#DC2626` + icon, wired via `role="alert"`.
- Minimum hit target **44×44px** on touch (36px inputs get ≥8px padding context).

### 4.5 Headings

- Exactly **ONE `<h1>` per page**. Use `<span>` for branding/logos in the header.
- Heading levels must not skip (h1 → h2 → h3, never h1 → h3).

### 4.6 ARIA

- Don't add redundant roles (`role="main"` on `<main>`, `role="banner"` on `<header>`).
- `aria-hidden` must be the string `"true"` or `"false"`, never a bare attribute.
- Every `Dialog` must include a `DialogDescription` (visually hidden via `class="sr-only"`
  if needed). Modals: `role="dialog"` `aria-modal` `aria-labelledby`.
- Status badges/toasts announce via `aria-live="polite"`.
- Charts get a text summary or data-table fallback.

### 4.7 Landmarks & navigation

- Use semantic HTML: `<main>`, `<header>`, `<nav>`, `<footer>`.
- Include a **skip-to-main-content** link as the first focusable element.
- Add `aria-label` to `<nav>` elements (e.g. `aria-label="Main navigation"`).

### 4.8 Keyboard

- All interactive elements keyboard-accessible: Tab, Enter, Space, Escape.
- Focus indicators: `focus-visible` with a visible outline — 3px `rgba(0,112,224,.35)`;
  never `outline: none` without a replacement. Defined once in `index.css`.
- Modals trap focus, close on Esc, and return focus to the trigger. Dropdown menus: Arrow
  keys navigate, Enter selects, Esc closes. Expandable table rows toggle with Enter/Space.
- Drag handles: `role="button"`, `tabIndex={0}`, descriptive `aria-label`.
- Every interactive element is reachable by Tab **in DOM order**.

### 4.9 Images & media

- All `<img>` have meaningful `alt` text, or `alt=""` if decorative.
- SVGs: `aria-hidden="true" focusable="false"` when decorative.

---

## 5. Motion, Charts & Content

### 5.1 Motion

| Pattern | Spec |
|---|---|
| Panel collapse / expand | width / `grid-template-columns`, `.28s ease` |
| Hover lift | `translateY(-1.5px)` + hover shadow, `.16s cubic-bezier(.22,1,.36,1)` |
| Press | scale `.88`–`.97`, same easing |
| Fly-in rows (added items) | slide + fade in ~250ms, green tick pop after |
| Saved confirmation | tick animates in, auto-fades |
| Dropdown / popover | `popIn` fade + 4px slide, ~140ms |
| Modal overlay | `fadeUp` .2s ease |
| Toasts | slide from bottom-right, auto-dismiss 3s |

Easing `ease` / `ease-out` / `cubic-bezier(.22,1,.36,1)`; nothing over 300ms. **All motion
gated by `prefers-reduced-motion`** — disable lift/fly-in/pulse, keep opacity fades ≤150ms.
No content flashes >3×/second.

### 5.2 Charts

Glossy/modern: richer gradient fills, glowing line drop-shadows, dark rounded hover tooltips
(`ChartTip`). **Bar baselines sit exactly on the axis line.** Palette derives from primary
blue + harmonious `oklch()` neighbors. Every chart pairs with an accessible text summary or
data-table fallback (§4.6).

### 5.3 Loading, empty & error states

- **Loading**: inline blue spinner with a label — never a blank screen.
- **Empty**: `EmptyState` (animated illustration + title + one-line explanation + primary
  action, e.g. a Browse gate). Never a bare empty area.
- **Error**: inline red text + icon near the cause (`role="alert"`), not global alerts.

### 5.4 Content style

- Title Case for screen names, sentence case for body/buttons. Concise labels ("Remove all",
  "Get resources").
- Numbers right-aligned in tables, tabular-nums.
- No emoji in product UI.
- Domain vocabulary is fixed: "Academic Report" (never "Marks Sheet"); badges awarded for a
  month span (Apr – Jun), never a single date; assessment windows Grade ≤5 → Evaluation
  1/2/3, Grade ≥6 → Term 1/2.

---

## 6. Applying this standard to any product

### 6.0 Contrast token quick-reference (copy verbatim — do not improvise)

**Text color on a given background — pick from this table, never a raw fill hue:**

| Background | Allowed TEXT colors |
|---|---|
| White / `--surface` | `--ink`, `--muted`, `--primary` (≥13.5px), `--success-text`, `--warning-text`, `--danger` |
| `--primary-tint` `#EAF3FE` (avatars, pills, chips, icon tiles) | `--on-tint-blue` `#005BB8`, `--ink` — **never** `--primary` `#0070E0` |
| Green badge tint `#E7F6EE` | `--success-text` `#0E7A36` — never `--success` |
| Amber badge tint `#FEF2E0` | `--warning-text` `#8A5200` — never `--warning` |
| Solid `--primary` `#0070E0` | white only, weight ≥600 |

**Fill/icon-only hues (never used as text):** `--success` `#16A34A`, `--warning` `#F59E0B`.
Decorative `aria-hidden` text (monogram initials, count pills) is scored by auditors — hold
it to the same table. When in doubt, run an automated contrast check (axe) before shipping.

### 6.1 Bootstrap checklist

A short checklist to bootstrap a new SARAS product on this system:

1. **Tokens first.** Wire §1 as your design tokens (CSS variables or theme object). Load
   Poppins. Nothing hardcoded outside the tables.
2. **Copy the primitives.** Bring in `lib/css.js`, `Dropdown`, `Pager`, `formKit`, `icons`,
   `consoleUtils`. Route all inline styles through `css()`. Build screens only from these.
3. **Shell.** Stand up the §3 header + nav + `<main>` + skip link before any feature screen.
4. **Every screen passes §4.** One `<h1>`; labelled controls; `aria-label` on icon-only
   buttons; portal-mounted overlays; visible focus rings; keyboard paths; 4.5:1 text
   contrast. Treat these as CI gates.
5. **States are not optional.** Ship loading, empty (`EmptyState`), and error states with
   every data view.
6. **Motion + content** per §5, all gated by `prefers-reduced-motion`.
7. **Extend, don't fork.** New pattern? Add it to this document and this component set rather
   than a one-off — this file stays the single source of truth.

— End of Skills.md —
