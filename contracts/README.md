# GymBro external API contract (V3.0)

Transport: POST `/api/gymbro`, Content-Type application/json, Supabase-issued bearer access token. No user ID parameter selects ownership. OAuth clients must have a current GymBro grant in addition to valid identity. No ChatGPT-specific objects, API keys or tools exist.

Read committed account state (`training:read`):

```json
{"op":"state"}
```

Response: `{state, revision, digest}`. State is schema 7; revision is account concurrency metadata. State may be null for an uninitialized account. Reads never create workout history.

Read trainer evidence (`training:read`):

```json
{"op":"action","action":"getTrainerWorkoutContext","args":[{"asOfDate":"2026-10-25"}]}
```

Response: `{result, revision}`. Result is the existing evidence envelope with explicit unknowns and no prescriptions. `asOfDate` is a caller-supplied local calendar date. Other selectors and action inputs retain V2_ARCHITECTURE.md, GUIDED_WORKOUTS.md and TRAINER_EVIDENCE.md contracts.

Mutation example (`workout:write`; use actual inspected session/slot/revisions):

```json
{
  "op":"action",
  "action":"logGuidedSet",
  "args":[{
    "sessionId":"actual-session-id",
    "planSlotId":"actual-slot-id",
    "expectedRevision":3,
    "requestId":"stable-logical-submission-id",
    "weight":100,
    "unit":"lb",
    "reps":8
  }],
  "expectedRevision":12,
  "requestId":"stable-transport-attempt-id"
}
```

The nested revision is the existing guided revision. The outer revision guards the whole account. The nested request ID is the existing durable logical set identity; the outer request ID identifies an HTTP operation. Keep all original values and IDs on a transport retry. HTTP receipt lookup precedes account revision checking, so a committed request can be resolved after its response was lost. Different request content with the same transport ID fails. Transport receipts preserve NO_CHANGE/REPLAY outcomes without rewriting workout state. Do not turn stale revisions into blind retries with refreshed versions.

Action response retains `{ok,code,errors,changes,...identifiers}` and includes `revision`. `state` is returned only to the first-party account or a client also granted training:read. Domain errors remain structured action results; authentication/authorization/transport errors use HTTP 4xx/5xx with `{code,message}`. HTTP 503 PERSISTENCE_UNCERTAIN requires an exact explicit retry, never a new logical set. Authentication/authorization checks always precede replay, so revocation stops retries too.

The complete action/scope allowlist is `permissions.cjs`. Missing/unknown actions deny. Do not infer history:modify from workout:write. First-party `restore`, `merge`, `reset`, `import-preview`, `import-commit`, `consent`, `consent-details`, `grants` and `revoke` are unavailable to OAuth trainer clients regardless of their scopes. There is no trainer API for whole-state replacement.

Trainer authorization uses Supabase's authorization-code PKCE flow and registered client redirects. GymBro's consent page chooses application permissions separately from OIDC identity scopes. Disconnecting revokes the grant while retaining all GymBro workout facts. This contract does not establish any actual provider integration; use synthetic clients for staging acceptance.
