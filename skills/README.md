# GymBro skills

GymBro may contain multiple independent ChatGPT/agent skills. Each skill owns its own directory under `skills/` and uses a conventional entry file named `SKILL.md`.

The filename is intentionally repeated. Skill identity comes from the directory plus the skill metadata/frontmatter, not from globally unique filenames.

## Repository convention

```text
skills/
  README.md
  workout-coach/
    SKILL.md
    references/
    tests/
  workout-onboarding/
    SKILL.md
    references/
    tests/
```

Additional skills should follow the same structure when explicitly approved. Examples that may be considered later include `workout-review/` or `program-design/`; their presence here is illustrative and does not authorize implementation.

## Skill boundaries

Keep skills narrow enough that their activation, state, communication style, and responsibilities remain coherent.

- `workout-coach` — live daily workout coaching. Owns contextual workout activation/closure, live-session interpretation, progression judgment, joint-safety decisions, recovery/junk-volume control, and concise gym-floor interaction.
- `workout-onboarding` — planned under issue #60. Owns new-user/history-assisted onboarding and creation/confirmation of the persistent athlete/coaching profile consumed by the daily coach.

Do not collapse unrelated workflows into one giant GymBro skill merely to reduce file count. Shared product/data authority belongs in GymBro architecture/data contracts; each skill should reference those shared contracts rather than duplicate them.

## `SKILL.md` convention

Every skill directory should contain exactly one primary `SKILL.md` entry point.

`SKILL.md` should contain:

- skill name and activation description/frontmatter;
- scope and non-goals;
- authority/data-source rules;
- the executable procedure/policy for that skill;
- ambiguity/failure behavior;
- references to supporting files when needed.

Supporting evidence, longer reference material, examples, and behavioral scenarios belong under the skill's own `references/` and `tests/` directories instead of inflating the entry file unnecessarily.

## Activation

Multiple installed skills may be contextually eligible in the same conversation. The most specific current intent should control which procedure is active.

Examples:

- `I'm at the gym, let's get some` → `workout-coach`.
- `Set me up so GymBro can coach me going forward` with no usable profile → `workout-onboarding` when implemented.
- A user with an established profile starting a normal workout should use `workout-coach`, not rerun onboarding.

Skills should not require magic command phrases unless a future product decision explicitly requires one.

## Shared GymBro authority

All GymBro skills must preserve the same core boundary:

- GymBro owns durable facts, identities, historical truth, and persisted coaching/profile state.
- ChatGPT/skills own interpretation and reasoning within their approved scope.
- Actual performance is authoritative; recommendations are not performed workout facts.
- A skill must not create a parallel durable workout database or silently overwrite GymBro truth.
- Transport (manual interchange today, MCP/API later) is separate from skill policy.

## Current registry

| Skill | Status | Entry point | Tracking |
| --- | --- | --- | --- |
| Workout Coach | Implemented on current design PR; not yet merged/installed | `skills/workout-coach/SKILL.md` | #63 |
| Workout Onboarding | Planned | `skills/workout-onboarding/SKILL.md` | #60 |

Issue #61 tracks future live GymBro MCP/API connectivity and the corresponding update to the Workout Coach transport path. It should not change the directory/entry-point convention or require rewriting core coaching policy.