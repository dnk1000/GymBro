# Heritage Utility design system

Implementation contract for [#71](https://github.com/dnk1000/GymBro/issues/71). This is presentation guidance; workout/domain, storage, identity and navigation contracts remain governed by their owning documents.

## Tokens and hierarchy

`styles.css` owns the shared tokens in `:root`. Extend these tokens instead of adding screen-specific palette values.

| Purpose | Tokens / rule |
| --- | --- |
| Surfaces | `--bg` charcoal page; `--panel` primary card; `--panel2` raised/selected; `--surface-inset` nested details, inputs and charts |
| Type | `--text` warm near-white; `--muted` readable supporting copy; `--heritage` ivory brand/major headings |
| Action | `--accent` oxblood fill; `--on-accent` button text; `--accent-hover` / `--accent-active` feedback; `--accent-text` lighter warm chart/indicator ink |
| Semantics | `--good`, `--warn`, `--bad` readable green/gold/red; matching `*-surface` badges. Preserve text/status labels; color alone is insufficient. |
| Borders | `--line` structural dividers; `--control-line` stronger form boundary; notices retain a semantic left rule |
| Typography | `--font-brand` local Georgia/Times serif for wordmark and h2; `--font-ui` system sans for h3, controls, tables, labels and dense details. No external fonts. |
| Numbers | Tabular numerals in metrics, tables, form values and set/count summaries; KPI size/weight dominates supporting labels. No fact, unit or precision changes. |
| Spacing | `--space-1` through `--space-6`: 4/8/12/16/24/32 px. Use shared rhythm; keep contextual layouts where needed. |
| Corners | 6 px controls/nested detail; 10 px panels; full-radius status pills |
| Depth | Flat bordered panels; shadow reserved for modal dialog; no decorative texture or faux materials |

## Components and interaction

Primary buttons use oxblood/ivory; secondary buttons use raised charcoal with a divider; destructive buttons retain a distinct red border. Enabled buttons have hover/pressed feedback. Disabled state remains disabled and visibly muted. Controls inherit system typography, a distinct border and inset background. Buttons/form controls have 44 px minimum height; existing compact desktop History icon actions are an intentional contextual exception (phone icons retain 44 px).

Cards, nested items, chart backgrounds, notices, pills and dialogs share the palette. Shared line charts read CSS tokens rather than maintaining a separate blue palette; chart math/data is unchanged. Native select/date/checkbox affordances use the dark color scheme. A light focus outline identifies keyboard position; disclosure outlines remain inside their summary so they are not clipped.

Retain existing responsive grids, scroll containers, disclosure behavior and 16 px phone form text to avoid Safari focus zoom. Keep screen-specific information architecture and controls. Do not apply serif fonts to dense tables, forms or set records. Existing contextual spacing, chart dimensions, compact badge sizes and History mobile layout remain intentional exceptions to blanket normalization.

## Validation and state

Change Level 1: reversible presentation changes within existing product, architecture, data and compatibility boundaries. Validation covers baseline/final visual inspection, all seven views at desktop/390/320 px, navigation, focus/control states, representative contrast pairs, console errors, unchanged navigation storage, existing browser/domain regressions and syntax/release/diff checks. Exact results and acceptance mapping belong in [the delivery evidence](https://github.com/dnk1000/GymBro/pull/76). Responsive Chrome does not establish physical iPhone Safari acceptance.

## Shared app shell (#72)

The unchanged strongman logo sits beside the ivory serif wordmark. The supporting “Your training ledger” line is hidden on phones up to 480 px; the wordmark/logo and Help/Backup remain visible in one row. The header uses a flat charcoal surface and divider. Navigation retains horizontal scrolling, seven labeled native buttons and 48 px targets; current view has an ivory label and warm underline, with matching `aria-current` state. Keyboard focus stays inside the scroll container. No alternate menu or hidden destination is introduced. Desktop keeps a left brand/right utility alignment; phone top-row spacing is reduced. The global version footer has a divider and wrapping build label. Screen-specific layouts, content and workflows continue to inherit shared components without redesign.
