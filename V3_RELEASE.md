# GymBro V3.0 integration milestone

Application version: `3.0.0-20261025T232240Z`
Data schema: `7`
Release status: **preparation**

Baseline: `d2e6223f5d6020cb63c249ade4c02acaa7fe7cbd` (PR #8). V2 remains incompletely accepted: physical iPhone results, verified production JSON backup/data acceptance, and final production smoke/release evidence are outstanding. This milestone does not close those gates.

V3.0 supplies the shared local/async domain persistence boundary, per-user JSONB API, Supabase identity/OAuth integration, explicit trainer permissions, database RLS, account controls, consent/revocation, and reviewed migration. It does not provide AI coaching, voice, ChatGPT integration, exercise reordering, live-plan adaptation, or offline synchronization.

Local validation: npm ci, syntax, release metadata and whitespace checks passed. The full ordinary suite ran 158 tests: 157 passed, zero failed, one managed-Chromium direct-file navigation skip. The explicit PostgreSQL suite ran nine tests, all passed. Account browser tests were rerun after the final consent-redirect adjustment: three passed. The Node development server served all seven views at 320px, denied unauthenticated mutations, served the pinned SDK, and kept unconfigured connected mode disabled. Supabase staging identity/OAuth, real restricted staging login/RLS, Vercel deployment and physical Safari remain unverified until explicitly recorded. Local browser auth fixtures are simulations, not Supabase acceptance. No production deployment or merge is authorized.

See V3_ARCHITECTURE.md for contracts and V3_STAGING.md for setup and acceptance.
