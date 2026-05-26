# How to install the workflow files

The agent's GitHub PAT only has `public_repo` scope — not `workflow` — so it
cannot write directly to `.github/workflows/`. You have two options:

## Option A (2 min via GitHub web UI)

1. Open https://github.com/Maxime8123/thehive-collective
2. Click `Add file` → `Create new file`
3. In the filename field type: `.github/workflows/daily-distribution.yml` (slashes auto-create the directory)
4. Paste the content of `cron-drafts/daily-distribution.yml` from this same repo
5. Click `Commit changes` (commit directly to main is fine)
6. Repeat for `.github/workflows/hourly-monitor.yml` (content from `cron-drafts/hourly-monitor.yml`)
7. Done. First daily run will be 03:17 UTC; first hourly run will be at :23 past the next hour.

You can verify it's working at https://github.com/Maxime8123/thehive-collective/actions

## Option B (1 min — gives the agent the scope)

1. Open https://github.com/settings/tokens
2. Find your classic PAT (the one starting `ghp_gwZ0...`)
3. Edit → check the `workflow` scope checkbox → `Update token`
4. Tell me "PAT has workflow scope now" and I'll push the workflow files directly.

## What the workflows do

- **Daily distribution** (03:17 UTC): Pings the live API for KB count + agent stats. Asks GPT-4o-mini to draft 10 specific dev-domain findings, submits them to the live KB (server-side quality gate filters platitudes). Commits the log.
- **Hourly monitor** (:23 past every hour): Pings api.thehivecollective.io/health (alerts in the log if 5xx). Polls comment counts on the 3 open awesome-list PRs. Fetches dev.to comment counts per article. Commits the log.

All output goes to `AUTONOMOUS-LOG.md` in the repo. Open it any time to see what the bot did.

Secrets are already pushed (encrypted at rest). View them at https://github.com/Maxime8123/thehive-collective/settings/secrets/actions :
- HIVE_API_KEY · OPENAI_API_KEY · DEV_TO_API_KEY · HUGGINGFACE_TOKEN · GH_READ_PAT

Rotation: when you rotate the source tokens in `.env.local`, re-run `scripts/push-cron-workflow.mjs` to refresh.
