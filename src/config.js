const DEFAULT_COLLECTORS = ["openclaw", "claude-code"];

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function intFrom(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function stringFrom(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function arrayFrom(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function systemTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function systemLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

function normalizeRoutePrefix(value) {
  const raw = stringFrom(value, "/openclaw-fuel-gauge");
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/g, "") || "/openclaw-fuel-gauge";
}

export function resolveFuelGaugeConfig(raw = {}) {
  const commands = typeof raw.commands === "object" && raw.commands ? raw.commands : {};
  const collectors = arrayFrom(
    raw.collectors ?? env("OPENCLAW_FUEL_GAUGE_COLLECTORS"),
    DEFAULT_COLLECTORS,
  );

  return {
    routePrefix: normalizeRoutePrefix(raw.routePrefix ?? env("OPENCLAW_FUEL_GAUGE_ROUTE_PREFIX")),
    collectors,
    timezone: stringFrom(raw.timezone ?? env("OPENCLAW_FUEL_GAUGE_TIMEZONE"), systemTimezone()),
    locale: stringFrom(raw.locale ?? env("OPENCLAW_FUEL_GAUGE_LOCALE"), systemLocale()),
    commands: {
      openclawBin: stringFrom(commands.openclawBin ?? env("OPENCLAW_FUEL_GAUGE_OPENCLAW_BIN"), "openclaw"),
      claudeCredentialsPath: stringFrom(
        commands.claudeCredentialsPath ?? env("OPENCLAW_FUEL_GAUGE_CLAUDE_CREDENTIALS"),
        "~/.claude/.credentials.json",
      ),
      claudeUsageEndpoint: stringFrom(
        commands.claudeUsageEndpoint ?? env("OPENCLAW_FUEL_GAUGE_CLAUDE_USAGE_ENDPOINT"),
        "https://api.anthropic.com/api/oauth/usage",
      ),
      timeoutMs: intFrom(commands.timeoutMs ?? env("OPENCLAW_FUEL_GAUGE_TIMEOUT_MS"), 45_000, { min: 5_000, max: 300_000 }),
    },
  };
}
