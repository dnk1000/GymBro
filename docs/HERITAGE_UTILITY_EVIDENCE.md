# Heritage Utility delivery evidence

## #71 shared-system checkpoint

Scope: [#71](https://github.com/dnk1000/GymBro/issues/71) only at this checkpoint, based on accepted main `2255a91c38f0f28c9678dc322c603d2c3850f09c`; branch `codex/71-72-heritage-utility`. #72 has not started. Presentation-only patch `3.11.1-20261030T165311Z`, schema 8 unchanged. Change Level 1: reversible shared styling within existing product/domain/data boundaries. The user requested sequential #71/#72 in one branch/PR, without merge.

Implementation: [design system](DESIGN_SYSTEM.md), centralized CSS palette/typography/spacing/radius/depth and component states; four chart ink assignments consume CSS tokens. No chart calculation, screen information architecture, workout action, schema, migration, dependency or storage change. Exact files at this checkpoint: `styles.css`, `app.js`, `app-version.js`, `scripts/check-release.cjs`, `tests/app-version.test.cjs`, `tests/release-tools.test.cjs`, `docs/DESIGN_SYSTEM.md`, this evidence file, `docs/CURRENT_ARCHITECTURE.md`, `docs/README.md`, `docs/V3_RELEASE.md`, `docs/RELEASE_HISTORY.md`, `docs/CHANGELOG.md`.

Validation: 238/238 existing tests passed, zero skipped (Windows desktop Chrome, disposable storage); 9/9 focused version/release tests; 58-file syntax, canonical release/schema and diff checks passed. All seven destinations at 1280/390/320 px: no page overflow, no uncaught browser errors and navigation does not write storage. Baseline and revised screenshots inspected. Brand/h2 use Georgia; controls/dense text remain system sans. Representative contrast pairs: main text 13.76:1; muted on elevated 6.69:1; primary button 6.41:1; hover 5.27:1; semantic badges at least 5.95:1; control border 4.11:1; focus 10.07:1. 108 local Markdown link targets exist.

AC identifiers follow the issue's acceptance bullets in order.

| Criterion | Method / evidence | Result |
| --- | --- | --- |
| AC-1 documented system | CSS token source, DESIGN_SYSTEM and current architecture/map links | PASS |
| AC-2 shared tokens | Palette/radius/shared spacing audit; chart ink uses the same tokens | PASS |
| AC-3 coherent components | Desktop/phone visual review across seven views, control/notice/pill rules | PASS |
| AC-4 distinct heading/data type | Computed Georgia h2 vs system-sans controls; screenshot inspection | PASS |
| AC-5 clean modern UI | Flat charcoal panels, oxblood controls; no texture/external font added | PASS |
| AC-6 responsive/accessibility/function preserved | 238 regressions; 21 view/width checks; focus rules/contrast; desktop History icon regression retained | PASS |
| AC-7 no domain/data change | Diff audit: chart ink only in app.js; no storage/schema/action change | PASS |
| AC-8 desktop/320/390 styling/readability | All 21 view/width checks, visual inspection and contrast calculation | PASS |

Negative evidence: first regression run was 236/238 because a canonical-version assertion was stale and global button min-height enlarged desktop History icons. Updated the version expectation and restored the existing icon dimensions; the original icon test is unchanged. Final full rerun passed 238/238. Contextual spacing, chart dimensions, native affordances, compact pills and desktop History icons remain intentional exceptions documented in the system. Shared 44 px controls temporarily increase header height; shell density belongs to #72.

No personal/Production data accessed. Backup/migration/DB/device suites are not applicable to this styling scope. Physical iPhone Safari is not tested or claimed; neither issue explicitly requires physical-device acceptance. Preview verification is pending before the #72 handoff. No acceptance, merge or Production deployment is claimed. Existing dirty #39 checkout is preserved untouched at `C:/Source/GymBro`.

### #71 Preview verification and sequencing gate

Before any #72 implementation, verified [exact Preview](https://gymbro-1ghu2zzv4-dnk-9999.vercel.app) ([deployment](https://vercel.com/dnk-9999/gymbro/FpttoaMHsK5PTKTocL7XM5WcC1NX)), source `1f4ae482e5b62707303a308bdc2b9eb217a3f188`, exact displayed build `3.11.1-20261030T165311Z`: all seven views at 1280/390/320 px passed, no page overflow, no console warnings/errors or uncaught errors, no navigation storage writes. Initial anonymous Preview check reached Vercel protection, so no app result was claimed from that attempt; retried with the existing signed-in Vercel CLI's authorized Preview cookie. No protection configuration changed.

#71 implementation and required technical verification are complete at this checkpoint; product review/acceptance and merge remain unclaimed. Its implemented tokens/components are now the foundation for #72 in the same authorized work package. No separate human acceptance gate is specified in either issue contract. PR: [#76](https://github.com/dnk1000/GymBro/pull/76), unmerged.

## #72 shared-shell checkpoint

#72 implementation began only after the recorded #71 checkpoint above. Uses the same shared tokens, with no second palette or component system. Change Level 1: presentation/accessibility semantics within existing navigation behavior. Patch `3.11.2-20261030T170057Z`, schema 8 unchanged. Branch/PR/base remain as above.

Changes: left-aligned strongman/ivory wordmark with right-aligned Help/Backup; simplified “Your training ledger” tagline hidden at phone widths; compact one-row phone branding; 48 px scrolling navigation buttons with a warm current-view underline; a named navigation landmark and matching `aria-current`; divided/wrapping version footer. Shared h2, panels, buttons, forms and notices inherit #71. Desktop/phone screen-specific structure and every existing destination/action remain. No Dashboard/Workout/History-specific redesign, #73/#74/#75 work, runtime dependency, persistence, schema or migration change.

Final source scope versus accepted main: `styles.css`, `index.html`, `app.js` (four chart colors plus navigation ARIA only), `app-version.js`, `scripts/check-release.cjs`, `tests/app-version.test.cjs`, `tests/release-tools.test.cjs`; documentation: `docs/DESIGN_SYSTEM.md`, `docs/HERITAGE_UTILITY_EVIDENCE.md`, `docs/CURRENT_ARCHITECTURE.md`, `docs/README.md`, `docs/V3_RELEASE.md`, `docs/RELEASE_HISTORY.md`, `docs/CHANGELOG.md`. Audited with Git diff/name/stat against `2255a91`; no unexpected files. Original #39 changes remain untouched in the separate original checkout.

Technical evidence: 238/238 full regressions pass, zero skipped, on final #72 source using desktop Chrome and disposable local storage. Syntax (58 files), release/schema and staged/unstaged/committed whitespace pass; 111 local Markdown targets exist. All seven views at 1280/390/320 px fit without page overflow/uncaught errors. Additional shell checks at each width: all seven buttons work with keyboard Enter, exactly one current-view attribute matches the visible destination, visible keyboard focus, navigation and utility targets at least 44 px; Help opens/closes; Backup downloads valid schema-8 complete JSON; navigation/help/backup leave localStorage byte-for-byte unchanged. Same representative contrast checks pass. Screenshots inspected for header, controls, History and desktop/phone hierarchy.

Chrome header heights including navigation: baseline desktop 145 px / 390 px phone 143 px / 320 px phone 152.17 px; final desktop 130 px / both phones 114 px. #71's intermediate 182 px phone shell is replaced by this #72 compact layout. Horizontal navigation scrolling remains intentional; it does not cause page-level overflow.

| Criterion | Method / evidence | Result |
| --- | --- | --- |
| AC-1 shell matches #71 | Reused tokens/components; desktop/phone screenshot inspection | PASS |
| AC-2 intentional responsive header/navigation | 130/114 px shell; all-width interaction and overflow checks | PASS |
| AC-3 coherent preserved logo/wordmark | Same unchanged PNG and crop; ivory serif title, compact alignment | PASS |
| AC-4 all existing destinations usable | Seven click/keyboard destinations at every width; current-view state | PASS |
| AC-5 accessible consistent shared controls | #71 contrast, focus, 44 px utility/48 px nav targets, Help/Backup checks | PASS |
| AC-6 functionality/navigation preserved | 238/238 regressions and shell interactions | PASS |
| AC-7 no domain/data changes | Diff audit: CSS/markup/chart ink/ARIA/release metadata only; no storage/action/schema/dependency files changed | PASS |
| AC-8 desktop/390/320 no new page overflow | All 21 view/width cases and keyboard reachability checks | PASS |

Release handling: presentation-only patches under the existing policy, no new feature minor assigned. Historical #71 build/evidence retained; current candidate records/check expectations aligned to #72. Owning visual guidance updated. No accepted shipped-release claim. Data migration/rollback/compatibility transformations and Production backup are not applicable: no data-path changes or personal-data testing. No scope deviations. #71 CI [41094596625](https://github.com/dnk1000/GymBro/actions/runs/41094596625) passed. Final #72 Preview/CI verification follows after push; not yet claimed here. Physical iPhone Safari remains not tested; Chrome is not Safari evidence. Product acceptance/merge remain pending; PR stays unmerged.
