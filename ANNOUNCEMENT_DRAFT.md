# Announcement Draft

Do not post this automatically. Review and edit before publishing anywhere.

## GitHub repo description

Unofficial OpenClaw Control UI fuel-gauge PoC: manually refresh provider remaining capacity before starting expensive agent work.

## Suggested GitHub topics

`openclaw`, `control-ui`, `usage-limits`, `rate-limits`, `claude-code`, `codex`, `plugin`, `userscript`, `agent-ui`, `quota`

## OpenClaw Discord/community post

I built a small unofficial OpenClaw Control UI fuel-gauge PoC.

It adds a manual `⛽ Limits` button that shows provider remaining capacity before starting expensive agent work. The goal is to make “should I start this big run now?” easier to answer without spending LLM tokens or polling in the background.

Current sources:

- OpenClaw provider usage via `openclaw status --usage --json`
- Claude Code via the Claude Code OAuth usage endpoint

Safety stance:

- manual refresh only
- source/confidence labels on every card
- no `ccusage`/log-derived remaining-limit estimates
- no Claude Code statusLine hooks/caches
- Gateway-authenticated plugin routes

I’d especially like feedback on:

1. whether this belongs as a core Control UI affordance,
2. the JSON/API shape,
3. how provider-reported remaining limits should be normalized across providers,
4. where this UI should live in the Control UI.

Repo: <URL>

## GitHub Discussion / OpenClaw core proposal draft

Title: Proposal: manual provider “fuel gauge” in Control UI before expensive agent work

Problem:

When starting an expensive agent run, users often need to know whether the selected provider is near a short-window or weekly cap. Today that information is not surfaced in the Control UI at the moment of decision.

Proposal:

Add a manual “fuel gauge” affordance that shows provider-reported remaining capacity and reset windows. The key design constraints are:

- manual refresh, no background polling by default;
- no token spend just to check capacity;
- label every data source and confidence level;
- prefer provider-reported remaining-limit data;
- do not treat log-derived usage estimates as remaining-limit truth.

Reference PoC:

<URL>

Current PoC data sources:

- `openclaw status --usage --json`
- Claude Code OAuth usage endpoint

Questions:

- Should this be a Control UI core feature, plugin surface, or both?
- What should the canonical JSON shape be?
- How should stale/unavailable provider data be represented?
- What should providers expose to make this reliable?
