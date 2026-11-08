# GymBro V1.6 — ChatGPT Import Format

The #82 candidate also accepts the separate [versioned batch envelope](BATCH_WORKOUT_IMPORT.md), reusing this single-workout payload unchanged. Rich historical session/ID/context preservation uses existing validated history documents inside that envelope; it is not inferred from this sessionless format.

V1.6 accepts JSON pasted into the **ChatGPT Inbox** or loaded from a `.json` file. The existing `gym-tracker-chatgpt-v1` interchange schema is retained.

The preferred format is:

```json
{
  "schema": "gym-tracker-chatgpt-v1",
  "importId": "2026-10-22-pull-01",
  "date": "2026-10-22",
  "template": "B — Pull + Arms",
  "duration": 60,
  "bodyweight": null,
  "notes": "Optional session-level note",
  "exercises": [
    {
      "exercise": "Seated Row",
      "sets": [
        {
          "weight": 100,
          "unit": "lb",
          "reps": 12,
          "rpe": 7,
          "rir": null,
          "pain": 0,
          "painArea": "",
          "notes": "clean"
        }
      ]
    }
  ]
}
```

The app also accepts a flat top-level `sets` array. Supply either `sets` or `exercises`, not both. Missing weights or reps are preserved as incomplete records rather than guessed. Set `complete: false` to mark approximate data even when both numbers are available. Session-level `notes` are preserved in import history and JSON backups. The #18 cloud candidate adds [explicit exercise resolution](SMART_IMPORT_RESOLUTION.md): known canonical IDs/names/aliases resolve automatically; unknown labels require mapping, explicit new Uncategorized/default exercise creation, or exclusion before commit. Similar exercise/equipment names are never silently merged. Non-Production V2 development adapters retain their existing unknown-name creation behavior; a classification editor remains outside scope.

`importId` is used for duplicate protection. If omitted, the app generates a deterministic ID from the workout contents.

Prefer a stable, unique explicit `importId` per workout. Correcting or deleting committed sets does not remove that ID. Generated IDs retain V1.5's representation for compatibility; changing workout contents can produce a new ID.

Excluded sets are not saved. After committing the selected sets, importing excluded sets later requires a separate future import with a new import ID; the original ID cannot be reused. Resolution choices do not recalculate the existing generated import ID.

Dates must be real calendar dates in `YYYY-MM-DD` form. Supported load units are `lb`, `lb/side`, `assist lb`, and `bodyweight`. Loads must be nonnegative finite numbers, reps positive whole numbers, RPE 1–10, RIR a whole number 0–10, and pain 0–10. Optional duration and bodyweight must be positive. Invalid values block commit; missing load/reps and unknown exercise names are review warnings. Unchecked sets are excluded from validation and commit.
