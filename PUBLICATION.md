# Publication Notes

This project is being prepared for possible public release as an unofficial OpenClaw fuel-gauge PoC.

## Recommended release shape

1. Publish as a small experimental GitHub repository first.
2. Treat the repository as the canonical demo/spec artifact, not the whole distribution strategy.
3. Keep npm/package publishing disabled (`"private": true`) until there is a real packaging plan.
4. If the idea is useful, use this repo as reference material for an OpenClaw core proposal or PR.

## Discoverability plan

A standalone repo is unlikely to be discovered by itself. Pair it with a few intentional surfaces:

1. **OpenClaw community post** — share a screenshot/GIF and the GitHub link in Discord/community channels.
2. **OpenClaw core discussion/issue** — frame it as a UX/API proposal: “manual remaining-capacity gauge before expensive agent work”.
3. **ClawHub/plugin listing if appropriate** — only after the install/update story is clean enough for other users.
4. **GitHub topics/SEO** — use topics such as `openclaw`, `control-ui`, `usage-limits`, `rate-limits`, `claude-code`, `codex`, `plugin`, `userscript`.
5. **README demo-first landing** — keep the top of README screenshot/GIF-oriented, with a short problem statement and install path.
6. **Short announcement copy** — prepare a concise post that explains the problem, the safety stance, and what feedback is wanted.

## Public safety checklist

Before publishing:

- [ ] Confirm no personal workspace files are committed (`AGENTS.md`, `USER.md`, `SOUL.md`, `.openclaw/`, etc.).
- [ ] Confirm no secrets, OAuth tokens, hostnames, private paths, screenshots with private data, or local config are committed.
- [ ] Confirm Claude Code data comes only from the OAuth usage endpoint, not statusLine cache.
- [ ] Confirm every displayed data source has a `source` and `confidence` label.
- [ ] Confirm README states this is unofficial and experimental.
- [ ] Decide whether to keep the repository name as `openclaw-fuel-gauge-poc` or rename before first public push.

## Not included by design

- Background polling.
- Log-derived remaining-limit estimates.
- Claude Code statusLine hooks or caches.
- OpenClaw core file modifications.

## Open questions

- Should this remain a standalone PoC repository, or become an OpenClaw core proposal/PR?
- Should the Control UI integration eventually be a first-class plugin surface rather than a userscript/bookmarklet overlay?
- How should non-Claude/OpenClaw providers expose provider-reported remaining limits consistently?
