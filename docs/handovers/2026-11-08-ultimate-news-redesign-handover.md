# Ultimate News — mobile refresh + Golden Summer Fields palette

Handover for implementation. Design reference (canvas, 6 artboards): https://claude.ai/artifact/9PDanbiprBe9EiGCtzbkcM
Artboards: Mobile Home/archive · Mobile Search open · Mobile Category sheet · Mobile Article · Desktop Archive · Tokens.

## 0. Before you start

- **The local clone may be stale.** `main` here is at `316cbe5` (9 Aug 2026) and has no "Today's brief" component, but the live site does. Run `git pull` first and re-locate the components named below — names here are from the older checkout and may have moved.
- Work on a branch, e.g. `feat/mobile-refresh-palette`.
- Stack: Next.js app router, Tailwind 4 (`@theme` in `app/globals.css`), CSS variables for colour, `.dark` class for dark mode, IBM Plex Sans + Source Serif 4 via `next/font`. Keep all of that.
- Breakpoint: "mobile" = below Tailwind `md` (768px). Desktop layout stays as is apart from colour (section 7).

## 1. Colour tokens (`app/globals.css`)

Palette is **five colours only**, plus neutrals. Rule: **text on any of the five is always dark ink. Never white text on them, never bronze as text.**

```css
:root {
  /* palette */
  --sage:   #CCD5AE;  /* Dry Sage */
  --beige:  #E9EDC9;  /* Beige */
  --cornsilk: #FEFAE0;
  --papaya: #FAEDCD;  /* Papaya Whip */
  --bronze: #D4A373;  /* Light Bronze — fill only, never text */

  /* surfaces */
  --bg: #FEFCF0;               /* cornsilk mixed 50% with white: page + header */
  --surface: var(--papaya);    /* chips, tags */
  --surface-elevated: #FFFFFF; /* image cards */
  --border: var(--papaya);
  --border-strong: var(--sage);

  /* text */
  --text: #1A1C18;
  --text-body: #3A3E33;
  --text-muted: #5C5F4E;
  --text-faint: #7D806F;       /* icons/decoration only, not body text */

  /* roles (replace old green/rust/ochre/blue usages) */
  --accent: var(--text);       /* links, focus ring, primary buttons */
  --highlight: var(--bronze);  /* the ONE highlight: brief numbers, date badge, active filter, search ring */
  --panel: var(--beige);       /* brief panel, key points, selected row */

  /* categories (keyed on Article.primaryArea) */
  --cat-world: var(--sage);
  --cat-environment: var(--sage);
  --cat-business: var(--papaya);
  --cat-tech: var(--beige);
  --cat-science: var(--beige);
  --cat-travel: var(--bronze);
  --cat-sport: var(--bronze);
  --cat-fallback: var(--beige);
}

.dark {
  --bg: #1C1D17;
  --surface: #26281F;
  --surface-elevated: #2D3027;
  --border: #3A3D30;
  --border-strong: #4A4E3E;
  --text: #FEFCF0;
  --text-body: #E9EDC9;
  --text-muted: #B5B8A3;
  --text-faint: #8C8F7C;
  --accent: var(--text);
  --panel: color-mix(in oklab, var(--beige) 12%, var(--surface));
  /* in dark mode the five colours are used as TEXT, dots and 1px pill outlines;
     tinted backgrounds = color-mix(in oklab, <colour> 12%, var(--surface)) */
}
```

Then:
- Remove `--accent-2/3/4`, `--accent-warm` and the old green values. Grep every usage (`accent-2`, `accent-3`, `accent-4`, `#1F4E3D` etc.) and remap: links/hover/focus → `--accent`; dots/badges → `--highlight` (as a fill); "Covered by N sources" text → `--text-muted`.
- Add a small helper, e.g. `lib/categoryColor.ts`, mapping `primaryArea` → CSS var name, falling back to `--cat-fallback` for unknown categories (categories come from the DB, so new ones must not break).
- `.kb-focused` outline → `var(--accent)`.

**Measured contrast (WCAG 2.x), light:** ink on bg 16.7 · on sage 11.2 · on beige 14.2 · on papaya 14.8 · on bronze 7.6 · muted on bg 6.4 · muted on papaya 5.6 · muted on white 6.6 · faint on bg 3.9 (icons only).
**Dark:** text on bg 16.5 · body 14.1 · muted 8.4 · faint 5.1 · sage-as-text 11.1 · bronze-as-text 7.5 · papaya-as-text 14.6.
**Known failures — do not use:** white on bronze 2.3 · bronze text on beige 1.9.

## 2. Mobile header (< md)

Replace the stacked title + tagline + search field + category chips with **one 56px row**:
- Left: "Ultimate News" wordmark (serif, 22px, bold). Link to `/` (keep `hideRead` param behaviour).
- Right: four icon buttons, each **44×44px**, `aria-label` on each: Search · Filter categories · Hide read (existing `HideReadToggle`) · Theme (existing `ThemeToggle`).
- Background `--bg`, 1px bottom border `--border`, sticky as now.
- **Tagline: removed on mobile.** Keep it on desktop.
- **Search icon** → the row swaps to a full-width search field (autofocus, 16px font to avoid iOS zoom, 2px `--highlight` border, white fill) plus a close (×) button. Esc / × closes and restores the row. Submits to the same `q` param as today. Results list: category pill, serif headline with the match wrapped in `<mark>` (bronze fill, ink text), "Source · time" line.
- **Filter icon** → bottom sheet (`role="dialog"`, focus trapped, Esc and scrim-tap close, drag handle). Title "Categories" + "Clear" text button. Rows 52px tall: colour dot (category colour, 1px ink@25% border so pale colours stay visible) + name; selected row = `--panel` background, semibold, check icon, `aria-pressed="true"`. Selecting navigates with the existing `category` param and closes the sheet.
- **Active filter indicator**: bronze dot on the filter icon, plus a strip under the header: "Showing [Business ×]" — pill in `--highlight` fill, ink text; × clears the category.
- The `CategoryFilter` chip row and `SearchBar` field are hidden below md.

## 3. Today's brief (both breakpoints)

- **Headlines only.** No summaries. Each item: number · headline (serif, 17px mobile / 18px desktop, semibold, links to article) · one meta line: source name + **one** tag (the category, short form e.g. "World", "Business").
- Panel: `--panel` background (beige), radius 16px, ink text. **No dark green.**
- Numbers: 26–28px circle, `--highlight` fill, ink serif numeral.
- Tag pill: category colour fill, ink text, 12px.
- Item dividers: 1px `rgba(26,28,24,.10)`.
- Desktop: two columns of items inside the panel.

## 4. Day header in the archive feed

Replace "Latest Stories / Page x of y" with a day header per date group:
- Serif 28px (mobile) / 40px (desktop): "Sunday **8** November", the day numeral in a bronze-filled circle.
- Under it, a row of count chips per category for that day ("World 6", "Business 4"…), category colour fill, ink text, 12–13px.
- Desktop: 2px ink rule under the header.
- Group articles by local date (Europe/Prague). Pagination can stay; keep "Page x of y" small and below the grid if you still want it.

## 5. News card

Applies at all sizes unless noted.
- **Remove the topic chips** (`article.topics` list and the "+N").
- **Eyebrow** = `CATEGORY · first topic`, e.g. "TRAVEL · Diwali traditions". Category uppercase semibold, topic regular. Only the first topic is ever shown.
  - On image cards: pill sits top-left on the image, `--bg` fill, ink text.
  - On text-only cards: pill above the title.
- **Mobile only:** remove the divider and the "Read summary" button; make the **whole card one `<Link>`** (one tab stop, one accessible name = headline). Add a pressed state (e.g. `active:scale-[0.99]` + slightly darker bg) and visible focus ring.
- **Desktop:** keep the "Read summary" button for now.
- Summary: `line-clamp-3` on mobile (was 5).
- **Text-only cards** (no `imageUrl`): background = category colour, no border; eyebrow pill `--bg` fill.
- **Image cards:** white surface, 1px `--border`, radius 14px. Image placeholder/loading background = category colour.
- Meta row: source (semibold, `--text-body`) left, time (`--text-muted`) right, 13px.
- Read state: keep `opacity-60` + "Read" badge (`--bg` fill, muted text).
- "Covered by N sources" line: keep, only renders when `totalSourceCount > 1` (already the case).

## 6. Article page (`app/article/[id]/page.tsx`)

- **Hide the Coverage box when `cluster.totalSourceCount <= 1`** (or no cluster). Keep the code for multi-source clusters.
- In its place, centred under the "Read on <source>" button: `Source: **tagesschau** · National outlet` — the label comes from the source type you already store (wire / national / independent → "Wire service" / "National outlet" / "Independent outlet").
- Eyebrow pill (category colour, ink text) above the title; 6px category-colour bar under the mobile header.
- Key points box: `--panel` background, small uppercase heading in `--text-body`, bronze bullet dots.
- Article tags (the 3 topic chips) stay here, `--surface` (papaya) fill.
- "Read on …" button: ink fill, white text, 52px tall, external-link icon.

## 7. Desktop (≥ md)

Layout unchanged except: page/header bg `--bg`; search field white with `--border`; category chips get a colour dot each, active chip ("All" or selected) = bronze fill, ink text; brief, day header and cards as above. Masonry grid stays.

## 8. Out of scope / don't touch

Data model, ingest, clustering, keyboard navigation logic (`useKeyboardNav`, `KeyboardNavWrapper` — but check the whole-card link still works with it), pagination logic, read-cookie logic.

## 9. Acceptance checklist

- [ ] 390px: header is one 56px row; first card or brief visible without scrolling past chrome.
- [ ] No topic chips on any card; eyebrow shows category + max one topic.
- [ ] Mobile cards: whole card tappable, no "Read summary" button, keyboard focus visible.
- [ ] Brief: no summaries, source + one tag per item, beige panel.
- [ ] Article page: no coverage box for single-source stories.
- [ ] Only the five palette colours + neutrals appear (grep for old hexes returns nothing).
- [ ] No white text on palette colours; no bronze text anywhere.
- [ ] Unknown `primaryArea` renders with fallback colour, no crash.
- [ ] Search overlay and category sheet: Esc closes, focus returns to the icon that opened them, focus trapped while open.
- [ ] All icon buttons have `aria-label`, ≥ 44×44px.
- [ ] Dark mode checked on every screen; body background painted.
- [ ] `prefers-reduced-motion`: sheet/search open without animation.
- [ ] Check at 390, 768, 1024, 1440 and at 200% zoom.
