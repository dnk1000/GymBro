# GymBro V1.5

A local-first, phone-friendly workout tracker built around the current Baseline Split v1.

## What's in V1.5

- Editable 5-workout split with 60-minute and 30-minute versions.
- Core / accessory / substitute exercise roles.
- Exercise taxonomy by primary muscle, secondary muscles, movement pattern and type.
- Fast set logging with load, reps, RPE, RIR, pain and notes.
- Historical workout data preloaded from prior sessions.
- Bodyweight, performance trends, gains and problem flags.
- **ChatGPT Inbox** for turning a conversational gym session into structured workout data.
- Review/correct-before-commit workflow.
- Duplicate import protection using `importId`.
- Unknown exercise and incomplete-set warnings.
- JSON backup/restore and CSV export.

## Running it

Open `index.html` in a modern browser. There is no server and no account required.

Data is stored in that browser's local storage. Use **Backup** periodically if the data matters to you.

## ChatGPT workflow

At the end of a gym session, ask ChatGPT for a **GymBro import**. Paste the resulting JSON into **ChatGPT Inbox → Workout JSON**, choose **Review import**, make any corrections, then **Commit workout**.

The app accepts both a top-level `sets` array and an `exercises` array where each exercise contains `sets`. See `CHATGPT_IMPORT_SCHEMA.md` and `chatgpt-import-example.json`.

## Important migration fix

V1.5 fixes the prior migration behavior so edits to your workout split are preserved on reload rather than being replaced with the default program.

## Current architecture

V1.5 intentionally remains local-first. The import schema is designed so a later version can synchronize the same records through Google Drive/Sheets or a database without changing the workout history format.


## Branding
The app package includes `gymbro-logo.png`, the black-and-white vintage strongman GymBro emblem used in the header and browser icon.
