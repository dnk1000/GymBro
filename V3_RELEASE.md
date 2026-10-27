# GymBro 3.0.0 — Supabase workout storage review candidate

Application version: `3.0.0-20261027T022348Z`
Data schema: `7`
Release status: **preparation**

This is a new, narrowly scoped database-storage release on `v3/supabase-storage`, based on current GitHub main `d2e6223f5d6020cb63c249ade4c02acaa7fe7cbd`. No old integration branch was merged or cherry-picked. The existing GitHub repository and Vercel project remain the development/deployment path.

Configured deployments use Supabase Auth and per-user schema-7 JSONB state with RLS, transactional compare-and-swap revisions and idempotent saves. Existing workout actions and all seven views are retained. Local V2 data can be explicitly previewed/copied and read-back verified; its original bytes are not deleted or replaced. Missing/failed cloud services never cause writes to fall back to localStorage. Unconfigured static/development deployments retain legacy local operation to keep the baseline usable during setup.

No AI coaching, ChatGPT/provider integration, external trainer grants, MCP or custom workout server is included. The old closed PR #9 remains abandoned. This release does not complete the entire historical V3 vision. See SUPABASE_STORAGE.md for configuration, migration, security assumptions, tests and live acceptance requirements.

V2 physical-iPhone acceptance, production JSON backup/data acceptance and final V2 release evidence remain outstanding. Synthetic browser services and local PostgreSQL fixtures do not establish real Supabase/Vercel acceptance. Do not merge or change production until review and live validation are complete.
