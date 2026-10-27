# GymBro V2 baseline — Preview connection checkpoint

Application version: `2.7.2-20261027T152907Z`
Data schema: `7`
Release status: **preparation**

The accepted V2 baseline remains the workout engine. **V2 acceptance is not yet declared complete.** The current narrowly scoped checkpoint adds an optional Preview/local Supabase connection diagnostic before any workout-storage migration.

The 2.7.2 candidate saves/reads only one short test value in a separate RLS-protected table. Normal workout behavior, storage and schema remain unchanged. Production always disables the diagnostic. See [setup and manual verification](SUPABASE_CONNECTION_TEST.md). Live Supabase acceptance requires actual setup and a verified round trip; simulated tests alone are insufficient.

| Release evidence | Status |
| --- | --- |
| Starting accepted main | `38624d46268b638b78a37212453b075576f93cc2` — V2.7.1, [PR #11](https://github.com/dnk1000/GymBro/pull/11) |
| Candidate branch | `v3/supabase-connection-check` |
| Candidate revision / CI / preview | See the patch PR’s exact head SHA and checks; not a production revision |
| Production commit / deployment for this version | Pending candidate approval; V2.7.1 remains the delivered production baseline. No Production configuration changes are included. |
| M6 physical-iPhone acceptance | **Pending recorded device/iOS/browser/build/date and individual results** |
| Production JSON backup saved/parseable/retained | **User-browser verification remains unrecorded** |
| PRD discrepancy disposition | **Pending explicit product decision on reordering and live-session adaptation** |
| Post-merge production smoke / personal existing data check | **Pending** |
| Final merge approval | **Pending for this connection checkpoint.** Previous approval applied to PR #11. |

## Capabilities preserved

Explicit sessions and immutable plan intent; active recovery; ordered actual sets and local substitutions; guided start/navigation/Done/Skip/finish; durable request replay/revision guards; manual fallback; legacy/sessionless History and corrections; complete JSON backups/restore/conservative merge; read-only trainer evidence and transparent calculations. CI and canonical release validation are prepared without changing workout/domain behavior or schema.

## Trainer-facing baseline

See [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) for selectors, mutation contracts, result envelopes and replay/revision rules. getTrainerWorkoutContext composes existing guided state. ChatGPT supplies future intelligence; GymBro supplies factual memory, controls, persistence and dashboard. No AI/voice/coaching transport or cloud workout persistence exists in this release.

## Accepted limitations and deferred work

localStorage quota/eviction/concurrency limits; no cloud sync/accounts/offline shell; exercise identity by exact name key; no equipment or substitution equivalence; no inferred working/failure classification or structured trainer profile; transient unsaved inputs; no autonomous progression prescriptions. Future conversational reasoning, voice, workout generation and coaching are V3. Explicit V2 PRD gaps are separately classified in [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md), not silently deferred.

## Data safety and finalization

Schema remains 7 and key remains daveGymTrackerV1. Back up actual production JSON before the upgrade; preserve active guidance and committed request history. Code rollback does not restore or erase browser data. Never lower schema numbers/delete fields to force a downgrade. Follow [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md).

After physical results and other gates are recorded, obtain explicit merge approval. After accepted main deploys successfully, record the exact production commit, deployment URL/status, verified displayed version, existing-data confirmation, smoke results and accepted PRD exceptions here. Only then change release status to released and declare V2 complete. Failed verification stops release completion and follows the rollback procedure. No release tag or V3 start is authorized by this preparation artifact.


Historical merge authorization: the user explicitly approved PR #8 and subsequently PR #11. PR #11 delivered V2.7.1 and its CI/production workflow was verified using disposable data. Those approvals do not authorize merging the current checkpoint or supply physical-device results, certify a personal production backup, resolve the PRD discrepancies or declare V2 complete. Those evidence rows remain open.
