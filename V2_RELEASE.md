# GymBro V2 release candidate — Milestone 7

Application version: `2.7.0-20261025T002624Z`
Data schema: `7`
Release status: **preparation**

V2.7 is the intended completion release of the V2 trainer-infrastructure phase. **That phase is not yet declared complete.** This document becomes the V3 baseline reference only after the gates below and final production verification pass. No V3 development is included.

| Release evidence | Status |
| --- | --- |
| Starting accepted main | `7548553a1c957a11d4f83facfa6e901ce479cf32` — M6, production verified before preparation |
| Candidate branch | `v2/milestone-7-production-delivery` |
| Candidate revision / CI / preview | See the milestone PR’s exact head SHA and checks; not a production revision |
| Production commit / deployment for this version | User authorized merging [PR #8](https://github.com/dnk1000/GymBro/pull/8); its merge commit and main deployment checks identify the delivered revision. Final production acceptance remains pending. |
| M6 physical-iPhone acceptance | **Pending recorded device/iOS/browser/build/date and individual results** |
| Production JSON backup saved/parseable/retained | **User-browser verification remains unrecorded** |
| PRD discrepancy disposition | **Pending explicit product decision on reordering and live-session adaptation** |
| Post-merge production smoke / personal existing data check | **Pending** |
| Final merge approval | **User explicitly approved PR #8 and instructed merge into main.** |

## Capabilities preserved

Explicit sessions and immutable plan intent; active recovery; ordered actual sets and local substitutions; guided start/navigation/Done/Skip/finish; durable request replay/revision guards; manual fallback; legacy/sessionless History and corrections; complete JSON backups/restore/conservative merge; read-only trainer evidence and transparent calculations. CI and canonical release validation are prepared without changing workout/domain behavior or schema.

## Trainer-facing baseline

See [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) for selectors, mutation contracts, result envelopes and replay/revision rules. getTrainerWorkoutContext composes existing guided state. ChatGPT supplies future intelligence; GymBro supplies factual memory, controls, persistence and dashboard. No AI/voice/transport exists in this release.

## Accepted limitations and deferred work

localStorage quota/eviction/concurrency limits; no cloud sync/accounts/offline shell; exercise identity by exact name key; no equipment or substitution equivalence; no inferred working/failure classification or structured trainer profile; transient unsaved inputs; no autonomous progression prescriptions. Future conversational reasoning, voice, workout generation and coaching are V3. Explicit V2 PRD gaps are separately classified in [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md), not silently deferred.

## Data safety and finalization

Schema remains 7 and key remains daveGymTrackerV1. Back up actual production JSON before the upgrade; preserve active guidance and committed request history. Code rollback does not restore or erase browser data. Never lower schema numbers/delete fields to force a downgrade. Follow [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md).

After physical results and other gates are recorded, obtain explicit merge approval. After accepted main deploys successfully, record the exact production commit, deployment URL/status, verified displayed version, existing-data confirmation, smoke results and accepted PRD exceptions here. Only then change release status to released and declare V2 complete. Failed verification stops release completion and follows the rollback procedure. No release tag or V3 start is authorized by this preparation artifact.


Merge authorization update: the user’s latest instruction is to approve PR #8 and merge it into main. This authorizes the merge and normal main deployment despite the outstanding recorded gates; it does not supply physical-device results, certify a personal production backup, resolve the PRD discrepancies or declare V2 complete. Those evidence rows remain open.
