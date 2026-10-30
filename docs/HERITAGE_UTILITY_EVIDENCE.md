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
