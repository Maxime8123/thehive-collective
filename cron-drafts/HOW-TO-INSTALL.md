# How to install the workflow files

The agent's GitHub PAT only has `public_repo` scope — not `workflow` — so it
cannot write directly to `.github/workflows/`. You have two options:

## Option A (3 min via GitHub web UI) — RECOMMENDED

1. Open https://github.com/Maxime8123/thehive-collective
2. Click `Add file` → `Create new file`
3. Filename: `.github/workflows/daily-distribution.yml` → paste content from `cron-drafts/daily-distribution.yml` → commit
4. Repeat for the other 3:
   - `.github/workflows/hourly-monitor.yml` ← `cron-drafts/hourly-monitor.yml`
   - `.github/workflows/weekly-content.yml` ← `cron-drafts/weekly-content.yml`
   - `.github/workflows/weekly-ops.yml` ← `cron-drafts/weekly-ops.yml`

Verify it works at https://github.com/Maxime8123/thehive-collective/actions — the first run lands at the next cron tick.

## Option B (1 min — give the agent the scope)

1. Open https://github.com/settings/tokens
2. Edit your classic PAT → check the `workflow` scope → `Update token`
3. Tell me "PAT has workflow scope now" and I push the workflows directly.

## What the workflows do once active

| Workflow | Cron | What it does |
|---|---|---|
| `hourly-monitor.yml` | `23 * * * *` | API health ping (alerts in log if 5xx). Polls comments on 3 awesome-list PRs. Fetches dev.to comment counts per article. |
| `daily-distribution.yml` | `17 3 * * *` | KB health snapshot. Asks GPT-4o-mini to draft 20 specific dev-domain findings, submits to KB (quality gate filters). |
| `weekly-content.yml` | `47 18 * * 1,4` (Mon + Thu) | Picks a topic from the 7-slot rotation, asks GPT-4o-mini to write a 1500-2000 word technical article, publishes to dev.to under the `the-hive-collective` account. |
| `weekly-ops.yml` | `37 7 * * 0` (Sun) | Refreshes the HF Dataset + Space with the latest corpus snapshot. Needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secrets (TODO below). |

All output goes to `AUTONOMOUS-LOG.md`. Open it any time to see what the bot did.

## Required secrets (already pushed except 2)

Already in repo settings → secrets → actions:
- `HIVE_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `DEV_TO_API_KEY` ✅
- `HUGGINGFACE_TOKEN` ✅
- `GH_READ_PAT` ✅

Still needed for `weekly-ops.yml` (the HF refresh) — add via https://github.com/Maxime8123/thehive-collective/settings/secrets/actions:
- `SUPABASE_URL` (e.g. `https://abcd1234.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` (the long jwt; from Supabase dashboard → Project → API)

Without those, `weekly-ops.yml` skips gracefully (logs "skipped (missing creds)") — everything else runs.

## Kill switch

Pause any workflow at https://github.com/Maxime8123/thehive-collective/actions → click the workflow → `···` → `Disable workflow`. Restart with `Enable workflow`.

To rotate the source tokens in `.env.local` later: re-run `scripts/push-cron-workflow.mjs` from the Hive project to refresh the encrypted secrets.
