# GymBro V2 baseline — Preview connection checkpoint

Application version: `2.7.2-20261027T152907Z`
Data schema: `7`
Release status: **preparation**

Current authoritative source is GitHub `main`, verified baseline `ffd556e154ec19752c9f44031a95890d5954f200` after merged PRs #12 and #13. Development uses feature branches, GitHub PRs/CI and Vercel preview/production deployments. Normal workouts remain standalone/localStorage-based. The implemented exception is the optional Preview/local Supabase connection diagnostic; there is no workout-storage migration or external trainer runtime. The approved future cloud scope and M1 readiness are recorded in [V3 M0](V3_M0_SCOPE_AND_ACCEPTANCE.md).

V2.7 was the intended completion release of the V2 trainer-infrastructure phase. **That phase is not yet declared complete.** Preserve the evidence and open gates below. External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** The later unmerged PR #9 experiment is abandoned, retained only as historical reference; it does not change this baseline or certify V2 acceptance.

The merged 2.7.2 checkpoint saves/reads only one short test value in a separate RLS-protected table. Normal workout behavior, storage and schema remain unchanged. Production always disables the diagnostic. See [setup and manual verification](SUPABASE_CONNECTION_TEST.md). The basic live Save/reload/Read checkpoint and matching database row were verified on 2026-10-27 after user-applied Supabase setup; this is not acceptance of a workout-storage migration or the outstanding V2 release gates. Release status remains preparation because final V2 acceptance evidence is incomplete, not because the checkpoint is unmerged.

| Release evidence | Status |
| --- | --- |
| Historical checkpoint starting main | `e5f87a538dc2be8212d723024718e283816c748b` — standalone docs update over V2.7.1, [PR #11](https://github.com/dnk1000/GymBro/pull/11) |
| Delivered checkpoint branch | `v3/supabase-connection-check`; [PR #12](https://github.com/dnk1000/GymBro/pull/12) merged at `9db26f36626a0073d4939b28e2f93d4e54953e17` |
| Checkpoint revision / CI / preview | Final head `c6f42c419b8490b0870e9e4eb417bdd00b137c8e`; [CI 40536834968](https://github.com/dnk1000/GymBro/actions/runs/40536834968) succeeded. Live diagnostic Preview verification is recorded in PR #12. |
| Current main / deployment | [PR #13](https://github.com/dnk1000/GymBro/pull/13) merged at `ffd556e154ec19752c9f44031a95890d5954f200`; [main CI](https://github.com/dnk1000/GymBro/actions/runs/40540523451) succeeded; [Vercel deployment](https://vercel.com/dnk-9999/gymbro/HGXbWFL3JAXcQBm6vkXyf5wxbkUk) reports success. Docs-only changes retain app 2.7.2/schema 7. |
| M6 physical-iPhone acceptance | **Results remain unrecorded.** User explicitly deferred through M1 Preview-only account work; required before M2 migration testing. |
| Production JSON backup saved/parseable/retained | **Personal backup verification remains unrecorded.** Same explicit M0 deferral; required before M2 migration testing. |
| PRD discrepancy disposition | **User assigned reordering and live-session adaptation to V3 M4.** Accepted baseline omissions until then; neither is marked implemented. |
| Post-merge production smoke / personal existing data check | M0 read-only homepage/version requests returned HTTP 200 and exact 2.7.2 metadata. New interactive smoke and personal existing-data verification remain unrecorded; PR #11's disposable-context smoke does not supply them. |
| Merge status | PR #12 and PR #13 are merged. Their merge does not certify final V2 physical/personal-data acceptance or authorize merging the M0 documentation PR. |

## Capabilities preserved

Explicit sessions and immutable plan intent; active recovery; ordered actual sets and local substitutions; guided start/navigation/Done/Skip/finish; durable request replay/revision guards; manual fallback; legacy/sessionless History and corrections; complete JSON backups/restore/conservative merge; read-only trainer evidence and transparent calculations. CI and canonical release validation are prepared without changing workout/domain behavior or schema.

## Trainer-facing baseline

See [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) for selectors, mutation contracts, result envelopes and replay/revision rules. getTrainerWorkoutContext composes existing guided state. GymBro supplies factual memory, controls, local persistence and the standalone dashboard. Trainer-named structured APIs and manual ChatGPT interchange remain accepted features. External AI/provider intelligence is an optional, unscheduled concept; no AI/voice/coaching transport or cloud workout persistence exists in this release.

## Accepted limitations and deferred work

Current implementation: localStorage quota/eviction/concurrency limits; no cloud sync/accounts/offline shell; exercise identity by exact name key; no equipment or substitution equivalence; no inferred working/failure classification or structured trainer profile; transient unsaved inputs; no autonomous progression prescriptions. External conversational reasoning, voice, workout generation and coaching remain conditional on separate scope approval. Cloud persistence is now the approved next delivery direction in [V3 M0](V3_M0_SCOPE_AND_ACCEPTANCE.md); that decision does not mean it is implemented. The historical V2 classifications and explicit current disposition are in [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md).

## Data safety and finalization

Schema remains 7 and key remains daveGymTrackerV1. Back up actual production JSON before the upgrade; preserve active guidance and committed request history. Code rollback does not restore or erase browser data. Never lower schema numbers/delete fields to force a downgrade. Follow [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md).

The M0 user decision permits Preview-only M1 account work when separately requested while physical/backup evidence remains pending; those gates must be satisfied before M2 migration testing. Record actual physical results, verified personal backup, existing-data confirmation and interactive smoke evidence before declaring final V2 acceptance. Only then change release status to released. Failed verification stops release completion and follows the rollback procedure. This record does not authorize a release tag, M1 execution in the M0 task or any future merge/production change.


Historical merge authorization: the user explicitly approved PR #8 and subsequently PR #11. PR #11 delivered V2.7.1 and its CI/production workflow was verified using disposable data. PR #12 and PR #13 were subsequently merged. The M0 user decisions explicitly disposition the adaptation gaps and defer specified evidence gates; no merge approval supplies missing physical-device or personal-backup evidence. Those evidence rows remain open until verified.
