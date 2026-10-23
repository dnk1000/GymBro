# GymBro V1.5 — ChatGPT Import Format

V1.5 accepts JSON pasted into the **ChatGPT Inbox** or loaded from a `.json` file.

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

The app also accepts a flat top-level `sets` array. Missing weights or reps are preserved as incomplete records rather than guessed. Unknown exercise names are added to the exercise library as `Uncategorized` and can be classified later.

`importId` is used for duplicate protection. If omitted, the app generates a deterministic ID from the workout contents.
