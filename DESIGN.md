# ATLive Design System

A dark, editorial, Atlanta-nightlife aesthetic. Near-black canvas, one vibrant
amber accent, oversized display type, monospace for structure. The whole system
lives in CSS custom properties in `app/globals.css` — change a token there, not
in components.

## Tokens

### Color
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#121212` | App canvas (near-black, never pure black) |
| `--bg-2` | `#161616` | Recessed surfaces (media wells) |
| `--panel` | `#191919` | Cards, pills, selects |
| `--panel-2` | `#1f1f1f` | Elevated chip fills |
| `--line` / `--line-2` | `#2a2a2a` / `#383838` | Borders, hairlines |
| `--text` | `#f4f1ea` | Primary text (warm white) |
| `--muted` | `#a9a39a` | Secondary text |
| `--muted-2` | `#8a857d` | Tertiary text — AA-checked ≥4.5:1 on `--bg` at 13px+ |
| `--accent` | `#ffb433` | THE accent. Amber. Use sparingly: dates, active states, CTAs, brand |
| `--accent-ink` | `#1a1206` | Dark text on amber fills (never white on amber) |
| `--ok` / `--bad` | `#7fe0a3` / `#ff7a5c` | Status only |

One accent rule: amber is the only chromatic color. Everything else is the
greyscale ramp. If a new element needs to "pop," it earns amber or it stays grey.

### Type
| Token | Family | Use |
|-------|--------|-----|
| `--font-display` | Space Grotesk 700 | Headlines, card titles, section heads. UPPERCASE, tight tracking (`-0.02` to `-0.04em`), oversized |
| `--font-body` | Manrope | Body copy, blurbs |
| `--font-mono` | Space Mono | Structure: nav indices, dates, chips, stats, table headers, the pipeline diagram |

Monospace is a system signal — it says "data, structure, machine." Use it for
anything that's a label, count, timestamp, or index, never for prose.

### Motion
- One-shot `glitch-in` reveal on the hero headline (clip-path + jitter, `steps()`).
- Card entrance is a clip-path "pixel reveal" + lift; hover scales the poster image.
- All JS motion is gated by `useReducedMotion()` in components — the CSS
  `prefers-reduced-motion` block is not enough on its own for Framer Motion.

## Components

- **Numbered nav** (`.nav` / `.navlinks`): brand lockup left (amber `A` tile +
  `AT`**`Live`**), monospace `01 / 02 / 03` links right. `aria-current="page"` on
  the active item.
- **Poster card** (`.pcard`): 3:4 media well dominates — image or amber-tinted
  placeholder with the artist initial. A bottom scrim carries the amber mono date
  and the display title. Venue + neighborhood + chips sit in a slim meta strip.
- **Chips** (`.chip`): monospace, uppercase. `.genre` = filled, `.multi` = amber
  "seen in N sources" provenance badge.
- **Filters**: date pills (`.pill`), `select` dropdowns, and a neighborhood chip
  row (`.hood`). All interactive controls are ≥44px touch targets.
- **Metrics / tables** (`/pipeline`): `.metric`, `.ptable`, `.diagram` — amber
  numbers, monospace labels.

## Hard rules
1. Min touch target 44px on every interactive control.
2. Visible `:focus-visible` (amber ring) on everything keyboard-reachable —
   handled globally in `globals.css`.
3. Body text ≥16px; secondary text must clear AA (4.5:1) on `--bg`.
4. Amber text on dark, dark (`--accent-ink`) text on amber. Never white on amber.
5. Source-provided URLs/images pass `safeUrl()` (http(s) only) before render.
