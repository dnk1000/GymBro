# GymBro V1.6 — ChatGPT Import Format

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

The app also accepts a flat top-level `sets` array. Supply either `sets` or `exercises`, not both. Missing weights or reps are preserved as incomplete records rather than guessed. Set `complete: false` to mark approximate data even when both numbers are available. Session-level `notes` are preserved in import history and JSON backups. Unknown exercise names are added as `Uncategorized`; a classification editor is not yet available.

`importId` is used for duplicate protection. If omitted, the app generates a deterministic ID from the workout contents.

Prefer a stable, unique explicit `importId` per workout. Correcting or deleting committed sets does not remove that ID. Generated IDs retain V1.5's representation for compatibility; changing workout contents can produce a new ID.

Dates must be real calendar dates in `YYYY-MM-DD` form. Supported load units are `lb`, `lb/side`, `assist lb`, and `bodyweight`. Loads must be nonnegative finite numbers, reps positive whole numbers, RPE 1–10, RIR a whole number 0–10, and pain 0–10. Optional duration and bodyweight must be positive. Invalid values block commit; missing load/reps and unknown exercise names are review warnings. Unchecked sets are excluded from validation and commit.
