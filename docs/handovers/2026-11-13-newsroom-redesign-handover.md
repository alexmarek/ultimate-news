# Ultimate News: newsroom redesign, handover for Codex

Date: 2026-11-13. Supersedes `2026-11-08-ultimate-news-redesign-handover.md` (Golden Summer Fields palette, rounded cards). Do not implement that one.

Design canvas (read-only reference): https://claude.ai/artifact/6jxNFwSPUVBFmV1oxV42QG
Boards: front page desktop, front page phone, story desktop, story phone, type/colour/shape system. Fact-check verdicts, scores and "Why it matters to you" text on the boards are sample copy.

## 0. Working agreement (read first)

- Repo rules in CLAUDE.md/AGENTS.md apply: ask before git push, deleting/overwriting/renaming files, installing dependencies, any database command, deploys. Never run Prisma against the production-pointing .env.
- The working tree currently holds uncommitted fact-check work. Do the redesign on a separate git worktree and branch (for example `feat/newsroom-redesign` from the current commit), not in the same working tree.
- Ownership split to avoid conflicts:
  - Redesign owns: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, article page, `components/NewsCard.tsx` and header/footer/brief/markets components.
  - Fact-check owns: `app/fact-check/**`, `app/admin/**`, `lib/fact-check/**`, `components/2026-11-13-fact-check-*.tsx`.
  - Shared seam: the FactCheck summary module on the article page and the verdict word on list items. Build it as one component, `components/FactCheckSummary.tsx`, fed by the existing report data. Fact-check pages should adopt the new tokens after the redesign tokens land.
- Merge order: tokens first (small PR), then components, then pages.

## 1. Direction in one paragraph

Mature newsroom: black ink on white, hairline rules instead of cards, square corners, one oxblood accent used only for section labels and hover, serif headlines, sans labels. Hierarchy by size and position, not by boxes. No shadows, pills, gradients or rounded corners (radius 0 everywhere; avatars/icons none needed).

## 2. Tokens (Tailwind 4 `@theme` / CSS variables)

Light:
- paper #FFFFFF, wash #F5F3EE, rule #D8D5CC, image-hold #E6E3DB
- ink #111111 (headlines, rules that matter), body #2E2E2B, article-body #1F1F1D, meta #62625C
- accent #8E1B16 (section labels, link hover, current-nav underline)
- verdict: supported #1B6B3A, mixed #7A5200, false #A3271E, unverified = outline only (meta colour, no fill)
All text pairs measured at 5.5:1 or better on paper. Re-check any new pair.

Dark: specified in section 12 (values from the System board, contrast ratios on the board were computed by script; re-check after implementation).

Radius: 0. Borders: 1px rule colour; 1px ink for the masthead/header bottom; 3px ink above rail/module headings and nav sections; 2px double rule under masthead nav.

## 3. Type

- Newsreader (variable, opsz) for headlines, decks, article body. Libre Franklin for labels, meta, nav, tables, buttons. Both open licence (SIL OFL); load with `next/font` (self-hosted, EU-friendly, no Google request at runtime). Replaces IBM Plex Sans and Source Serif 4.
- Scale (desktop / phone):
  - Masthead wordmark 50 / 22, Newsreader 700, -0.5 tracking
  - Lead headline 58 / 36, 600, tight leading (about 1.03), `text-wrap: balance`
  - Brief item headline 26-28 / 22-24, 600
  - Article H1 50 / 34, 600, balance
  - Deck 23/32 desktop, 20/27 phone, Newsreader 400
  - Article body 20/31 desktop, 19/28 phone, measure about 640px
  - Section label 12 / 11.5, Libre Franklin 700, uppercase, +1.2px tracking, accent colour
  - Meta 12.5-13, Libre Franklin, meta colour; source name 600 ink
- Minimum interactive target 44px high (front-page nav links 44px high, story-page header links 56px).

## 4. Images (user wants plenty of them)

User feedback 2026-11-13: likes the design, hopes for more images; accepts a text-led layout if that is what a news site looks like. Decision: image-forward by importance, not equal tiles.

- Lead story: full-width image above or beside the headline (desktop: about 8 of 12 columns, 3:2; phone: full bleed 3:2 above the headline). The design boards show text only for the lead; add the image, it is intended.
- Brief items 2-5: thumbnail 4:3, 120-160px wide, right of the headline on phone, left or right on desktop, when an image exists.
- Day list: lead story of the day gets 200x132 image; other rows one-line text rows by design (low importance), but allow an 84-96px thumbnail when the item has one and importance is 3 or higher.
- Off-duty rail (travel/positive): thumbnails, as on the board.
- Article page: hero image under the deck, full column width, 3:2, with credit/source line; none if the source supplies none.
- Rules: no placeholder or stock imagery. If an item has no image, do not reserve space; the layout must stay balanced without it. Fixed aspect ratios with `aspect-ratio` and `object-fit: cover` to prevent layout shift. `next/image` with explicit `sizes`. Alt text empty (decorative) when the headline adjoins it, descriptive otherwise.
- [Unverified] How many items per day actually carry an image from the RSS feeds. Check `lib/config/sources.ts` feeds and the ingest code before promising image coverage; measure over a week and tell the user the share. Copyright: use only the image URL supplied by the source feed and link back to the source; do not re-host without checking licence terms. [Unverified] licence position of each source.

## 5. Front page (desktop, 1200px content width, 12 columns)

1. Utility strip: date, "Updated N hours ago" (warning style only when over 24h, see section 16), Hide read, Dark, search icon.
2. Masthead: wordmark centred/left, 50px. Below it a double-ruled nav: Front page / World / Business / Technology / Science / Environment / Good news / Travel, then "Fact checks" aligned right ("Affects you" is no longer a nav item, see section 16). Current section: 3px accent underline.
3. Today's Brief (importance >= 3, max 2 per category, 5 items, from `pickBrief`): item 1 as lead (image + 58px headline + deck + source/time + AI tag + "Why it matters to you" line); items 2-5 two-column grid, headline, source, optional thumbnail.
4. Right rail (340px): YOUR MARKETS (two tables: ETFs and fuel; nowrap; plus and minus signs, not triangle glyphs; negatives may be coloured false-red) and FACT CHECKS (latest verdicts: verdict word coloured, source name).
5. "Also from <day>" section: lead story with image, then one-line rows. Items already in the brief must not repeat here. Same-story reports fold into one item ("also in Euronews Business, The Verge").
6. Off duty rail: Travel and Positive with thumbnails; "N paid promotions hidden" link; older editions navigation by day ("Wednesday 11 November →").
7. Footer: AI disclosure, "22 sources" link, How this page is made, Keyboard shortcuts.

Remove from the old design: tagline, tag clouds on cards, "Read summary" buttons, key-points block, "corroboration %" bar (false precision from 2-3 sources), "(AI inference)" wording, coverage box (replace with "Also reporting this").

## 6. Front page (phone, 390px)

- Header 52px: wordmark, search icon, "Menu" (menu holds sections, Hide read, Dark, Fact checks; "Affects you" is the accordion described in section 16).
- Date strip with "Fact checks" link. Markets as one horizontal ticker strip (not tables).
- Brief: lead with full-bleed image, 36px headline; items 2-5 numbered, headline + source + 84px thumbnail where available.
- Day section: lead with image, rest one-liners; off duty; older editions.
- Whole row tappable. No tags, no "Read summary". Section filter lives in Menu; a horizontally scrolling section row was suggested by a reviewer and left out on purpose (user earlier asked for categories to be removed from the top). Revisit only if the user asks.
- Page length target about 2,000px for 12 stories (the old page was about 5,900px).

## 7. Story page

Desktop: 640px article column plus 340px sticky right rail.
- Section label (accent), H1, deck, one meta line: "Source name (link) · 12 November 2026, 09:14 CET · summarised by AI from the full article", then the AI "Why it matters to you" line with a small bordered "AI" marker, hero image, body, "Read the full story at <source>" (black button; an underlined text link is an acceptable lighter alternative), topic links as a plain sentence, NEXT UNREAD and PREVIOUS rows (the page must not be a dead end).
- Rail: FACT CHECK module, then "ALSO REPORTING THIS" (other sources on the same cluster; hide the whole block when there is only one source, which is the usual case).

Phone: same order in one column; fact-check module after the body; fixed bottom bar 60px: "Read at <source>" (black) and "Next unread".

## 8. Fact-check integration (matches Codex's report model)

Data model (from `lib/fact-check/*-report-schema.ts`): verdict `supported | mostly-supported | mixed | mostly-false | false | unverified`; confidence `high | medium | low`; score 0-10, nullable (null when unverified).
- Module on story page: heading FACT CHECK; verdict word in Newsreader 34px (28 phone) coloured by verdict; "Score 8 of 10 · confidence medium"; two-sentence summary; up to 2 key claims each with quote, claim verdict word and evidence count; link "Full report and evidence" to `/fact-check/[id]`; disclaimer line ("AI analysis against independently retrieved evidence, reviewed by an editor", only if the editor review step actually exists in the pipeline; otherwise drop the clause).
- Colour mapping: supported and mostly-supported = supported green; mixed = amber; mostly-false and false = false red; unverified = outline/meta, no score shown. Always show the verdict as a word, never colour alone.
- Proposed score bands (design proposal, not yet agreed with fact-check code): supported 9-10, mostly supported 7-8, mixed 4-6, mostly false 2-3, false 0-1. Codex: reconcile with what the assessor actually emits before using these on screen.
- Lists: show the verdict word after the source name on brief items and rail ("Mostly supported · Euronews Business"). Only render when a published report exists; no placeholder badge.
- Gate everything behind `FACT_CHECK_ENABLED`; with the flag off the UI must look complete.
- Do not display the sample verdicts from the design boards as real data.

## 9. States and accessibility

- Read items: ink to meta colour on the headline, no opacity tricks. Hide-read toggle stays.
- Focus: 2px ink outline, offset 2px, on every interactive element (matches the System board). Keyboard shortcuts already in the app keep working.
- Stale feed: "Updated N hours ago" turns into a visible warning at 24h+ (owner decision, section 16).
- Reduced motion respected; no animation needed.
- Prefer semantic landmarks: header, nav, main, article, aside, footer; section headings are real h2.

## 10. Out of scope here, queued as suggestions (separate tickets)

Ingest 2-3 times per day plus stale warning; filter paid promotions/weather/anniversaries at ingest; add global/wire sources and trim News On Japan; coverage-gap check against a wire top ten; story clustering and "what changed since yesterday"; follow-a-topic timelines; week-ahead calendar; alerts only for portfolio-relevant top stories; weekly travel digest; sources page showing share of feed. [Inference] These come from one day's snapshot (12-13 Nov 2026) and the source config, not a systematic audit.

## 11. Acceptance checklist

- No border-radius above 0 anywhere (grep for `rounded`, `border-radius`).
- Fonts via next/font, no runtime request to Google.
- Phone front page about 2,000px tall for 12 stories at 390px; no horizontal scroll at 320px.
- Lead story shows an image when the source supplies one; layout holds when it does not. (`pickBrief` articles are loaded with `include`, so `imageUrl` is already on them; confirm when wiring.)
- Brief items not repeated in the day list.
- Story page has next/previous and, on desktop, the sticky rail.
- Fact-check module renders from real report data only; absent when no report or flag off.
- Contrast: all text >= 4.5:1 light and dark.
- Lighthouse accessibility check run on front page and story page, results reported.
- Screenshots at 1440, 1024, 390 and 320 widths attached to the PR.

---

# Addendum (2026-11-13, same day): implementation detail

## 11. Reference images

In `design-reference/` (repo root, untracked):
- `2026-11-13-front-page-desktop-1440.png`, `2026-11-13-front-page-phone-390.png`
- `2026-11-13-story-desktop-1440.png`, `2026-11-13-story-phone-390.png`
- `2026-11-13-system-sheet-1200.png` (type, colour, dark, shape, verdict bands, states)

Caveats: the boards show no images (placeholders only on the day-lead and off-duty thumbnails); section 4 of this file is the authority for image placement. Fact-check text on the boards is sample copy. The phone images are rendered at 2x (780px wide); the real phone width is 390px.

## 12. Tokens: paste into `app/globals.css`

This replaces the Golden Summer Fields `:root` and `.dark` blocks and the font variables. Keep the `@import`, the `@custom-variant dark` line, the keyframes and the reduced-motion block. The old `--cat-*` palette, `.cat-fill`, `.cat-tint`, `.cat-card`, `.cat-dot` classes and `lib/categoryColor.ts` become unused by the new design; remove them when nothing references them (grep first, and ask before deleting files).

```css
@theme {
  --font-sans: var(--font-libre-franklin), system-ui, -apple-system, sans-serif;
  --font-serif: var(--font-newsreader), Georgia, 'Times New Roman', serif;

  /* type scale (size / line-height). Use clamp() between phone and desktop where noted. */
  --text-wordmark: 50px;            --text-wordmark--line-height: 52px;   /* phone header: 22px / 24px */
  --text-lead: 58px;                --text-lead--line-height: 59px;       /* phone: 36px / 37px */
  --text-h1: 50px;                  --text-h1--line-height: 52px;         /* story H1; phone: 34px / 36px */
  --text-brief: 26px;               --text-brief--line-height: 26px;      /* brief items 2-5; phone: 22px / 22px */
  --text-headline: 21px;            --text-headline--line-height: 25px;   /* day-list lead; phone 19px / 23px */
  --text-row: 18px;                 --text-row--line-height: 22px;        /* one-line rows */
  --text-deck: 23px;                --text-deck--line-height: 32px;       /* story deck; phone: 20px / 27px */
  --text-deck-front: 21px;          --text-deck-front--line-height: 30px; /* front-page lead deck */
  --text-article: 20px;             --text-article--line-height: 31px;    /* phone: 19px / 28px */
  --text-ui: 14px;                  --text-ui--line-height: 20px;
  --text-meta: 12.5px;              --text-meta--line-height: 18px;
  --text-label: 12px;               --text-label--line-height: 16px;      /* phone: 11.5px */
}

:root {
  --paper: #ffffff;
  --wash: #f5f3ee;
  --rule: #d8d5cc;
  --image-hold: #e6e3db;
  --ink: #111111;
  --body: #2e2e2b;
  --article: #1f1f1d;
  --meta: #62625c;
  --accent: #8e1b16;

  --verdict-supported: #1b6b3a;
  --verdict-mixed: #7a5200;
  --verdict-false: #a3271e;
  /* unverified = no fill, 1px meta-coloured outline, meta text */

  /* map onto the names the app already uses so untouched components keep working */
  --bg: var(--paper);
  --surface: var(--wash);
  --surface-elevated: var(--paper);
  --border: var(--rule);
  --border-strong: var(--ink);
  --text: var(--ink);
  --text-body: var(--body);
  --text-muted: var(--meta);
  --text-faint: var(--meta);
  --highlight: var(--accent);
  --success: var(--verdict-supported);
  --warning: var(--verdict-mixed);
  --error: var(--verdict-false);
}

.dark {
  color-scheme: dark;
  --paper: #141413;
  --wash: #1d1d1b;          /* [Inference] not on the board; chosen between paper and rule, check contrast */
  --rule: #3a3936;
  --image-hold: #262624;    /* [Inference] same */
  --ink: #edebe6;           /* 15.5:1 on paper */
  --body: #d2cfc8;          /* 11.8:1 */
  --article: #d2cfc8;
  --meta: #a3a098;          /* 7.1:1 */
  --accent: #f0857a;        /* 7.3:1 */
  --verdict-supported: #7cc79a; /* 9.2:1 */
  --verdict-mixed: #e0b15a;     /* 9.3:1 */
  --verdict-false: #f0857a;     /* 7.3:1 */
}

body { background: var(--bg); color: var(--body); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
mark { background: transparent; color: inherit; box-shadow: inset 0 -0.4em 0 color-mix(in srgb, var(--accent) 22%, transparent); }
```

Notes on the block:
- The board specifies focus as a 2px ink outline with 2px offset (not accent). Section 9 above said accent; use ink as written here.
- The old `.kb-focused` class has `border-radius: 0.75rem`; set it to 0.
- Search-match `mark` styling is a suggestion; the board has none.
- **Keep the old size tokens during migration.** The block above adds new `--text-*` size tokens; do NOT delete the existing ones (`display-1..3`, `headline-lg/md/sm`, `body-lg/md/sm`). Untouched components still use them (counted in the repo on 2026-11-13: `text-body-sm` 53 times, `text-body-md` 31, `text-headline-lg` 10, `text-headline-md` 8, `text-display-2` 7, `text-display-3` 6, others fewer). Remove each old token only when grep shows no use. Their sizes may be re-pointed to the closest new value if that looks right.
- **`--accent` changes meaning.** It used to equal the text colour (links, focus ring, primary buttons, about 10 uses in `app/` and `components/`). In the new tokens it is the oxblood section-label colour. Before pasting, grep `var(--accent)` and switch those uses to `var(--ink)`, otherwise buttons and links turn red.
- **Not run.** This CSS block has not been built or run against Tailwind 4 in your repo. Run the build and look at the pages before trusting it.
- `--wash`, `--image-hold` in dark are not on the board; confirm visually and by contrast check.

## 13. Fonts: replace in `app/layout.tsx`

```tsx
import { Newsreader, Libre_Franklin } from 'next/font/google';

const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],   // latin-ext covers Czech and German
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const libreFranklin = Libre_Franklin({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-libre-franklin',
  display: 'swap',
});
// <html className={`${newsreader.variable} ${libreFranklin.variable}`} ...>
```
`next/font/google` downloads and self-hosts at build time, so visitors make no request to Google. [Unverified] I did not test this exact snippet against your Next.js version; check the `opsz` axis option (Newsreader is a variable font with an optical-size axis; `axes: ['opsz']` may be needed) and that the build succeeds. The boards were rendered with the optical-size axis on.

Body tag: `font-sans text-ui`. Article body and headlines: `font-serif`.

## 14. Layout and spacing values from the boards

Units are px; the design is on a 4px grid.
- Container: max-width 1200, side padding 24 (phone: 16). 12 columns, 32px gutters.
- Front page masthead block: padding 20 0 16; three-part row (date left, wordmark centre, tools right), flex-wrap with 24px gap.
- Section nav: 1px ink rule on top, 3px double ink rule below; link height 44; gap between links 26; current item `box-shadow: inset 0 -3px 0 var(--accent)`.
- Main content top padding 28. Brief and rail are a flex row with gap 32 / 40; brief column grows, rail fixed 340.
- Brief lead: headline 58/59, weight 600, letter-spacing -1.3, `text-wrap: balance`, margin-bottom 16; deck 21/30 Newsreader beside a 240px column holding the AI line (13.5/20) and source line (12.5, source name 600 ink); block padding-bottom 24, then 1px ink rule.
- Brief items 2-5: 2-column grid, column gap 40; headline 26/26 weight 600; each separated by a 1px rule colour border; vertical padding 14-16.
- Rail module: 3px ink top rule, 12 padding-top, heading is the 12px uppercase label in ink (not accent); table rows padding 8 0, 1px rule colour between, numbers right-aligned, `white-space: nowrap`.
- Day list rows: padding 8 0 to 14 0, 1px rule colour bottom border; lead of the day has 200x132 image on the left, 16-24 gap.
- Section labels: uppercase, 12px / 700 / +1.2px tracking, accent colour (module headings are ink).
- Story page: article column max 640, aside 340, column gap 64; H1 50/52 weight 600, letter-spacing -1, margin-bottom 18; deck 23/32 margin-bottom 24; meta line 13/20 with 1px ink top border and 1px rule bottom border, padding 12 0; body paragraphs margin-bottom 20; NEXT/PREVIOUS list under a 3px ink rule, label column 112px nowrap.
- Phone: header 52 (1px ink bottom border), icon targets 44x44; page padding 16; lead 36/37; list items padding 14 0; fixed story bottom bar 60 high with 1px ink top border, primary segment ink background with paper text, secondary segment 132px.
- Buttons: height 44-52, square, primary = ink background and paper text; secondary = 1px ink border; text link = underlined. Verdict word sizes: 34 (desktop module), 32 (phone module), 14-15 in lists.
- Tables (markets): Libre Franklin 13.5, tabular numbers (`font-variant-numeric: tabular-nums`; the board did not set this, recommended), + and - signs, no triangles.

## 15. Component-to-file mapping (current repo, read 2026-11-13)

Current state: the front page (`app/page.tsx`) renders `SiteHeader` (with `MobileHeader` on phone), a desktop `CategoryFilter`, a grid of `MorningBrief` + `MarketPanel`, then per-day sections with `DayHeader` + `MasonryGrid` of `NewsCard`, then `Pagination` ("Page x of y") and a footer. The article page is `app/article/[id]/page.tsx` (405 lines) using `ArticleImage`, `SummaryView`, `ForYouNote`, a Coverage box and its own header.

| New design element | Existing file | Action |
|---|---|---|
| Fonts, tokens | `app/layout.tsx`, `app/globals.css` | Replace per sections 12-13 |
| Masthead (date, wordmark, tools) + section nav | `components/SiteHeader.tsx`, `CategoryFilter.tsx` | Rewrite as one `Masthead`; nav links use the existing `?category=` param |
| Phone header and Menu | `components/MobileHeader.tsx`, `CategorySheet.tsx` | Restyle: wordmark, search icon, "Menu"; the existing sheet becomes the Menu (sections, Hide read, Dark, Fact checks, Affects you) |
| Today's Brief (lead + items 2-5) | `components/MorningBrief.tsx` | Rewrite; data still from `pickBrief` in `lib/brief.ts`. Lead gets image from `article.imageUrl` |
| Markets rail | `components/MarketPanel.tsx` | Restyle to tables with +/- signs; phone: single strip |
| Fact-check rail on front page | none | New, flag-gated, reads published reports only |
| Day sections | `components/DayHeader.tsx`, `MasonryGrid.tsx`, `NewsCard.tsx` | `MasonryGrid` is replaced by a plain list (delete only after asking). `NewsCard` becomes a lead variant (image) and a one-line row variant. Remove tags, "Read summary" button, rounded corners, category fills |
| De-duplication against the brief | `app/page.tsx` | Add: filter brief article ids out of the day list |
| Same-story folding | `Cluster` relation already on articles | Show "also in <sources>" from `cluster` when `totalSourceCount > 1` |
| Older editions nav | `components/Pagination.tsx` | Replace "Page x of y" with day-stepping, see section 16 (decided) |
| Hide read, keyboard nav | `HideReadToggle.tsx`, `KeyboardNavWrapper.tsx`, `useKeyboardNav.ts` | Keep behaviour; restyle `.kb-focused` (no radius) |
| Story page | `app/article/[id]/page.tsx`, `SummaryView.tsx`, `ArticleImage.tsx`, `ForYouNote.tsx` | Rewrite layout to section 7. Drop key points and corroboration bar; "Coverage" box becomes "Also reporting this" (hidden when one source). `ForYouNote` becomes the "Why it matters to you" line |
| Fact-check module | new `components/FactCheckSummary.tsx` | Fed by existing fact-check report data; reuse `components/2026-11-13-fact-check-*.tsx` where sensible. Fact-check owner reconciles with the existing `/fact-check/[id]` page |
| Images | `components/ArticleImage.tsx`; `Article.imageUrl`, `Article.imageAlt` already exist in `prisma/schema.prisma` | No schema change needed; measure coverage (section 4) |
| Category colours | `lib/categoryColor.ts` and its test | Becomes unused; remove after confirming with the owner |

Owner decisions on the three open points are in section 16.

## 16. Owner decisions (2026-11-13), these override anything above that conflicts

1. **Page by day, up to 5 days back.** The front page shows one day of stories at a time. Navigation steps between days ("Wednesday 11 November →", "← Friday"), limited to today plus the 5 previous days. This replaces the `PER_PAGE=12` offset paging and "Page x of y" on the front page.
   - Interpretation to confirm in code comments: "5 days back" = today and the five calendar days before it; older days are only reachable through search. The existing 14-day freshness window in `lib/config/dailyFeed.ts` stays as the outer limit.
   - Use `lib/groupByDay.ts` for the day boundaries (it already groups by local day). Pass the day in the URL (for example `?day=2026-11-12`); default is the latest day that has stories.
   - Days with no stories (for example a quiet weekend): [Inference] skip them in the stepper instead of showing empty pages; the owner did not say. Implement as skip, easy to change.
   - Today's Brief shows only on the newest day. Category filter and Hide read keep working within the selected day.
   - Search results are not day-paged: [Inference] keep the existing offset paging for `?q=` results, since a search spans days. Confirm with the owner if this looks wrong.
   - With one day per page, the page may hold fewer or more than 12 stories; the lower-importance one-line rows keep long days short.
2. **"Affects you" becomes an accordion, placed high on the front page.**
   - Position: directly under the masthead nav, above Today's Brief. Collapsed by default. The control is a full-width row, 44px high or more, with a 3px ink top rule, the label "AFFECTS YOU" in the section-label style, a short count ("5 stories"), and a square chevron (no circle). `<button aria-expanded aria-controls>`, keyboard operable, state is not remembered between visits unless the owner asks.
   - Expanded: ranked list of stories where `forYou` is set, ordered by `importance` then `publishedAt` (the same ordering the current `?forYou=1` view uses), as one-line rows with the "Why it matters to you" line from `ForYouNote`. Cap at 5 with a link to the full list.
   - Remove "Affects you" from the section nav. Keep the `/?forYou=1` route working so existing links do not break (full list view).
   - This component is not drawn on the design boards. Follow the tokens and rules in this file; if anything is unclear, build the simplest version and flag it.
   - [Inference] On phone it sits under the date strip and above the brief, same behaviour; Menu no longer lists it.
3. **Stale warning at 24 hours.** "Updated N hours ago" stays as plain meta text and turns into a warning only when the newest fetch is more than 24 hours old. With day paging the line may be dropped later; do not remove it now. The ingest-cadence suggestion in section 10 is unchanged and still separate.
