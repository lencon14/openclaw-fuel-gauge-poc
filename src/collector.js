import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { resolveFuelGaugeConfig } from "./config.js";

const execFileAsync = promisify(execFile);
const PATH_WITH_COMMON_BINS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
].join(":");

function nowIso() {
  return new Date().toISOString();
}

function msUntil(timestampMs) {
  if (!Number.isFinite(timestampMs)) return null;
  return Math.max(0, timestampMs - Date.now());
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return null;
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function round1(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function expandHome(filePath) {
  if (typeof filePath !== "string") return filePath;
  if (filePath === "~") return homedir();
  if (filePath.startsWith("~/")) return `${homedir()}${filePath.slice(1)}`;
  return filePath;
}

function resetMs(value) {
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === "string" && value.trim()) return Date.parse(value);
  return NaN;
}

function normalizeUsedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 1) return number * 100;
  return number;
}

async function runJson(command, args, { timeoutMs }) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env: { HOME: homedir(), PATH: PATH_WITH_COMMON_BINS, NO_COLOR: "1" },
  });
  const text = String(stdout || "").trim();
  if (!text) {
    throw new Error(`${command} produced no JSON${stderr ? `: ${String(stderr).slice(0, 400)}` : ""}`);
  }
  return JSON.parse(text);
}

async function collectOpenClawUsage(config) {
  const status = await runJson(config.commands.openclawBin, ["status", "--usage", "--json"], {
    timeoutMs: Math.min(config.commands.timeoutMs, 60_000),
  });
  const providers = Array.isArray(status?.usage?.providers) ? status.usage.providers : [];
  return providers.map((provider) => {
    const windows = Array.isArray(provider.windows) ? provider.windows : [];
    return {
      id: provider.provider || provider.displayName || "unknown",
      name: provider.displayName || provider.provider || "Unknown provider",
      plan: provider.plan || null,
      source: "openclaw status --usage",
      confidence: "provider-reported",
      windows: windows.map((window) => {
        const usedPercent = Number(window.usedPercent);
        const leftPercent = Number.isFinite(usedPercent) ? Math.max(0, Math.min(100, 100 - usedPercent)) : null;
        const resetAtMs = Number(window.resetAt);
        const remainingMs = msUntil(resetAtMs);
        return {
          label: window.label || "window",
          usedPercent: round1(usedPercent),
          leftPercent: round1(leftPercent),
          resetAt: Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : null,
          resetIn: formatDuration(remainingMs),
          resetInMs: remainingMs,
        };
      }),
    };
  });
}

function claudeUsageWindow(label, limit) {
  if (!limit || typeof limit !== "object") return null;
  const usedPercent = normalizeUsedPercent(limit.used_percentage ?? limit.utilization);
  const leftPercent = Number.isFinite(usedPercent) ? Math.max(0, Math.min(100, 100 - usedPercent)) : null;
  const resetAtMs = resetMs(limit.resets_at);
  const remainingMs = msUntil(resetAtMs);
  return {
    label,
    usedPercent: round1(usedPercent),
    leftPercent: round1(leftPercent),
    resetAt: Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : null,
    resetIn: formatDuration(remainingMs),
    resetInMs: remainingMs,
  };
}

function claudePlanFromCredentials(credentials) {
  const subscriptionType = credentials?.claudeAiOauth?.subscriptionType;
  if (typeof subscriptionType !== "string" || !subscriptionType.trim()) return "Claude";
  const normalized = subscriptionType.trim().toLowerCase();
  if (normalized === "max") return "Claude Max";
  if (normalized === "pro") return "Claude Pro";
  if (normalized === "team") return "Claude Team";
  if (normalized === "enterprise") return "Claude Enterprise";
  return `Claude ${subscriptionType.trim()}`;
}

async function fetchJson(url, { headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status}: non-JSON response from ${url}`);
      }
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText || "request failed";
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function collectClaudeCodeOauth(config) {
  const credentialsPath = expandHome(config.commands.claudeCredentialsPath);
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  const accessToken = credentials?.claudeAiOauth?.accessToken;
  if (!accessToken) throw new Error(`Claude Code credentials have no OAuth access token: ${credentialsPath}`);

  const usage = await fetchJson(config.commands.claudeUsageEndpoint, {
    timeoutMs: Math.min(config.commands.timeoutMs, 30_000),
    headers: {
      "content-type": "application/json",
      "user-agent": "openclaw-fuel-gauge-poc/0.0.1",
      authorization: `Bearer ${accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
  });

  const windows = [
    claudeUsageWindow("5h", usage?.five_hour),
    claudeUsageWindow("Week", usage?.seven_day),
    claudeUsageWindow("Week Sonnet", usage?.seven_day_sonnet),
  ].filter((window) => window && (window.leftPercent !== null || window.resetAt));

  return {
    id: "claude-code",
    name: "Claude Code",
    plan: claudePlanFromCredentials(credentials),
    source: "Claude Code OAuth usage endpoint",
    confidence: "provider-reported",
    windows,
  };
}

const COLLECTORS = {
  openclaw: collectOpenClawUsage,
  "claude-code": async (config) => [await collectClaudeCodeOauth(config)],
};

export async function collectFuelGauge(rawConfig = {}) {
  const config = resolveFuelGaugeConfig(rawConfig);
  const startedAt = Date.now();
  const providers = [];
  const errors = [];

  for (const collectorId of config.collectors) {
    const collector = COLLECTORS[collectorId];
    if (!collector) {
      errors.push({ source: collectorId, message: `Unknown collector: ${collectorId}` });
      continue;
    }
    try {
      providers.push(...await collector(config));
    } catch (error) {
      errors.push({ source: collectorId, message: error?.message || String(error) });
    }
  }

  return {
    ok: errors.length === 0,
    generatedAt: nowIso(),
    elapsedMs: Date.now() - startedAt,
    config: {
      collectors: config.collectors,
      timezone: config.timezone,
      locale: config.locale,
      routePrefix: config.routePrefix,
    },
    providers,
    errors,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pretty = process.argv.includes("--pretty");
  collectFuelGauge()
    .then((snapshot) => console.log(JSON.stringify(snapshot, null, pretty ? 2 : 0)))
    .catch((error) => {
      console.error(error?.stack || error?.message || String(error));
      process.exitCode = 1;
    });
}
