# Security Notes

This is an unofficial experimental OpenClaw plugin PoC.

## Credential handling

The `claude-code` collector reads local Claude Code OAuth credentials in order to call Claude Code's OAuth usage endpoint. This is intentional for showing Claude Code remaining-capacity data.

The plugin should never:

- expose OAuth tokens in `/openclaw-fuel-gauge.json`, HTML, userscript output, logs, or errors;
- send Claude credentials anywhere except Anthropic's configured OAuth usage endpoint;
- use Claude Code statusLine hooks or statusLine caches as a data source;
- modify Claude Code global settings.

## Browser extension

The optional browser extension is a UI layer only. It uses `activeTab`, `scripting`, and `storage`; it does not request host permissions. It injects the overlay only when the extension icon is clicked, then reads the existing Gateway-authenticated plugin JSON route from the active page origin.

## Routes

Plugin routes are registered as Gateway-authenticated routes:

- `/openclaw-fuel-gauge.json`
- `/openclaw-fuel-gauge/`
- `/openclaw-fuel-gauge.user.js`
- `/openclaw-fuel-gauge.bookmarklet`

## Audit expectations

Static plugin audits may flag this PoC because it reads local credentials and performs a network request. Review the code before installing. The intended network destination for Claude Code usage is:

```text
https://api.anthropic.com/api/oauth/usage
```

## Reporting concerns

If this becomes a public repo, please report security concerns through GitHub issues only if they do not include secrets. For sensitive reports, use a private disclosure channel once one is configured.
