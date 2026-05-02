import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { collectFuelGauge } from "./src/collector.js";
import { resolveFuelGaugeConfig } from "./src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function sendJson(res, statusCode, value) {
  const body = JSON.stringify(value, null, 2);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
  res.end(text);
}

function panelHtml(config) {
  const endpoint = `${config.routePrefix}.json`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenClaw Fuel Gauge</title>
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { margin: 0; padding: 16px; background: Canvas; color: CanvasText; }
  button { border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); background: color-mix(in srgb, Canvas 90%, CanvasText 10%); color: CanvasText; border-radius: 999px; padding: 8px 12px; cursor: pointer; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .muted { opacity: .7; font-size: 12px; }
  .grid { display: grid; gap: 10px; }
  .card { border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 14px; padding: 12px; background: color-mix(in srgb, Canvas 94%, CanvasText 6%); }
  .provider { display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline; font-weight: 700; }
  .plan { font-weight: 500; opacity: .72; }
  .source-row { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-top: 3px; opacity: .68; font-size: 11px; }
  .pill { display: inline-flex; align-items: center; border: 1px solid color-mix(in srgb, #22c55e 45%, transparent); border-radius: 999px; padding: 1px 7px; font-size: 10.5px; font-weight: 650; line-height: 1.6; background: color-mix(in srgb, #22c55e 14%, transparent); color: #22c55e; opacity: 1; }
  .pill.stale { color: #fbbf24; border-color: color-mix(in srgb, #f59e0b 58%, transparent); background: color-mix(in srgb, #f59e0b 16%, transparent); }
  .note { margin-top: 3px; }
  .window { margin-top: 10px; }
  .window-title { font-weight: 700; }
  .bar { height: 9px; background: color-mix(in srgb, CanvasText 12%, transparent); border-radius: 999px; overflow: hidden; margin-top: 5px; }
  .fill { height: 100%; background: var(--oc-fuel-fill, #22c55e); width: 0%; }
  .fill.warn { background: #f59e0b; }
  .fill.danger { background: #ef4444; }
  pre { white-space: pre-wrap; font-size: 12px; }
</style>
</head>
<body>
  <div class="top">
    <div>
      <strong>OpenClaw Fuel Gauge</strong>
      <div id="stamp" class="muted">Not refreshed yet</div>
    </div>
    <button id="refresh">Refresh</button>
  </div>
  <div id="out" class="grid"><div class="muted">Press Refresh to fetch current remaining capacity.</div></div>
<script>
const ENDPOINT = ${JSON.stringify(endpoint)};
function normalizedBaseCandidates() {
  const path = (window.__OPENCLAW_CONTROL_UI_BASE_PATH__ || '').replace(new RegExp('/+$'), '');
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return [
    wsProto + '//' + location.host + path,
    location.protocol + '//' + location.host + path,
    wsProto + '//' + location.host,
    location.protocol + '//' + location.host,
    'default',
  ];
}
function readGatewayToken() {
  try {
    const prefix = 'openclaw.control.token.v1:';
    for (const base of normalizedBaseCandidates()) {
      const value = localStorage.getItem(prefix + base);
      if (value) return value;
    }
    const legacy = localStorage.getItem('openclaw.control.token.v1');
    if (legacy) return legacy;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
    }
  } catch {}
  return '';
}
function authHeaders() {
  const token = readGatewayToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}
const out = document.getElementById('out');
const stamp = document.getElementById('stamp');
const refresh = document.getElementById('refresh');
function text(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value == null ? '' : String(value);
  return node;
}
function fillClass(left) { return left == null ? '' : left < 20 ? 'danger' : left < 50 ? 'warn' : ''; }
function fillColor(left) { return left == null ? '#22c55e' : left < 20 ? '#ef4444' : left < 50 ? '#f59e0b' : '#22c55e'; }
function confidenceClass(confidence) { return String(confidence || '').includes('stale') ? 'pill stale' : 'pill'; }
function addSourceRow(card, provider) {
  const row = document.createElement('div');
  row.className = 'source-row';
  row.append(text('span', provider.source || 'unknown source'));
  row.append(text('span', provider.confidence || 'unknown confidence', confidenceClass(provider.confidence)));
  card.append(row);
}
function addWindow(card, windowInfo) {
  const wrap = document.createElement('div');
  wrap.className = 'window';
  const title = document.createElement('div');
  title.append(text('span', windowInfo.label || 'window', 'window-title'));
  if (windowInfo.leftPercent != null) {
    title.append(document.createTextNode(': ' + windowInfo.leftPercent + '% left' + (windowInfo.resetIn ? ' · reset ' + windowInfo.resetIn : '')));
    wrap.append(title);
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'fill ' + fillClass(windowInfo.leftPercent);
    fill.style.width = Math.max(0, Math.min(100, Number(windowInfo.leftPercent) || 0)) + '%';
    fill.style.setProperty('--oc-fuel-fill', fillColor(windowInfo.leftPercent));
    bar.append(fill);
    wrap.append(bar);
  } else {
    title.append(document.createTextNode(windowInfo.resetIn ? ' · reset ' + windowInfo.resetIn : ''));
    wrap.append(title);
    if (windowInfo.summary) wrap.append(text('div', windowInfo.summary, 'muted note'));
  }
  if (windowInfo.projectedUsagePercent != null) {
    wrap.append(text('div', 'projected used: ' + windowInfo.projectedUsagePercent + '%' + (windowInfo.status ? ' · ' + windowInfo.status : ''), 'muted note'));
  }
  if (windowInfo.note) wrap.append(text('div', windowInfo.note, 'muted note'));
  card.append(wrap);
}
function render(data) {
  stamp.textContent = data.generatedAt ? 'updated ' + new Date(data.generatedAt).toLocaleString() : 'updated';
  out.replaceChildren();
  for (const provider of data.providers || []) {
    const card = document.createElement('section');
    card.className = 'card';
    const header = document.createElement('div');
    header.className = 'provider';
    header.append(text('span', provider.name || provider.id || 'Unknown'));
    if (provider.plan) header.append(text('span', provider.plan, 'plan'));
    card.append(header);
    addSourceRow(card, provider);
    if (provider.note) card.append(text('div', provider.note, 'muted note'));
    if (provider.error) card.append(text('pre', provider.error));
    if (provider.windows && provider.windows.length) {
      for (const windowInfo of provider.windows) addWindow(card, windowInfo);
    } else {
      card.append(text('div', 'No active windows.', 'muted note'));
    }
    out.append(card);
  }
  if (data.errors && data.errors.length) {
    const card = document.createElement('section');
    card.className = 'card';
    card.append(text('strong', 'Errors'));
    card.append(text('pre', JSON.stringify(data.errors, null, 2)));
    out.append(card);
  }
}
async function load() {
  refresh.disabled = true;
  refresh.textContent = 'Refreshing…';
  try {
    const res = await fetch(ENDPOINT, { cache: 'no-store', headers: authHeaders(), credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
    const data = await res.json();
    render(data);
  } catch (error) {
    out.replaceChildren();
    const card = document.createElement('section');
    card.className = 'card';
    card.append(text('strong', 'Failed'));
    card.append(text('pre', error && (error.stack || error.message) || String(error)));
    out.append(card);
  } finally {
    refresh.disabled = false;
    refresh.textContent = 'Refresh';
  }
}
refresh.addEventListener('click', load);
load();
</script>
</body>
</html>`;
}

function bookmarkletHtml(config) {
  const scriptPath = `${config.routePrefix}.user.js`;
  const code = `javascript:(()=>{const s=document.createElement('script');s.src=${JSON.stringify(scriptPath + '?t=')}+Date.now();document.documentElement.appendChild(s)})()`;
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>OpenClaw Fuel Gauge Bookmarklet</title>
<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:32px auto;padding:0 18px;line-height:1.6;color:CanvasText;background:Canvas}
a.bookmarklet{display:inline-block;border-radius:999px;padding:12px 16px;background:#111827;color:white;text-decoration:none;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25)}
code,pre{background:color-mix(in srgb,CanvasText 10%,transparent);border-radius:8px;padding:2px 5px}pre{padding:12px;overflow:auto;white-space:pre-wrap}.muted{opacity:.7}
</style></head><body>
<h1>OpenClaw Fuel Gauge Bookmarklet</h1>
<p>Tampermonkeyなしで、OpenClaw画面に <strong>⛽ Limits</strong> ボタンを出すためのブックマークです。</p>
<p><a class="bookmarklet" href="${code}">⛽ Limits</a></p>
<ol>
<li>上の <strong>⛽ Limits</strong> ボタンをブックマークバーへドラッグします。</li>
<li>OpenClaw Control UIを開きます。</li>
<li>ブックマークバーの <strong>⛽ Limits</strong> を押します。</li>
<li>画面右下に <strong>⛽ Limits</strong> ボタンが出ます。</li>
</ol>
<p class="muted">ドラッグできない場合は、このページをブックマークしてからURL欄を下のコードに置き換えてください。</p>
<pre>${code.replaceAll('&','&amp;').replaceAll('<','&lt;')}</pre>
</body></html>`;
}

async function userScript(config) {
  const path = join(__dirname, "userscript", "openclaw-fuel-gauge.user.js");
  const text = await readFile(path, "utf8");
  return text
    .replaceAll("__OPENCLAW_FUEL_GAUGE_ENDPOINT__", `${config.routePrefix}.json`)
    .replaceAll("__OPENCLAW_FUEL_GAUGE_PANEL__", `${config.routePrefix}/`);
}

async function clientScript(config) {
  const path = join(__dirname, "userscript", "openclaw-fuel-gauge.client.js");
  const text = await readFile(path, "utf8");
  return text
    .replaceAll("/openclaw-fuel-gauge.json", `${config.routePrefix}.json`)
    .replaceAll("/openclaw-fuel-gauge/", `${config.routePrefix}/`);
}

export default definePluginEntry({
  id: "openclaw-fuel-gauge-poc",
  name: "OpenClaw Fuel Gauge PoC",
  description: "Manual refresh usage/remaining-capacity gauge for the OpenClaw Control UI.",
  register(api) {
    const config = resolveFuelGaugeConfig(api.pluginConfig || {});
    const jsonPath = `${config.routePrefix}.json`;
    const panelPath = `${config.routePrefix}/`;
    const scriptPath = `${config.routePrefix}.user.js`;
    const scriptTextPath = `${config.routePrefix}.user.txt`;
    const clientScriptPath = `${config.routePrefix}.client.js`;
    const bookmarkletPath = `${config.routePrefix}.bookmarklet`;

    api.registerHttpRoute({
      path: jsonPath,
      auth: "plugin",
      match: "exact",
      async handler(_req, res) {
        try {
          const snapshot = await collectFuelGauge(api.pluginConfig || {});
          sendJson(res, 200, snapshot);
        } catch (error) {
          sendJson(res, 500, { ok: false, generatedAt: new Date().toISOString(), error: error?.message || String(error) });
        }
        return true;
      },
    });

    api.registerHttpRoute({
      path: panelPath,
      auth: "plugin",
      match: "exact",
      handler(_req, res) {
        sendText(res, 200, panelHtml(config), "text/html; charset=utf-8");
        return true;
      },
    });

    api.registerHttpRoute({
      path: scriptPath,
      auth: "plugin",
      match: "exact",
      async handler(_req, res) {
        sendText(res, 200, await userScript(config), "application/javascript; charset=utf-8");
        return true;
      },
    });

    api.registerHttpRoute({
      path: scriptTextPath,
      auth: "plugin",
      match: "exact",
      async handler(_req, res) {
        sendText(res, 200, await userScript(config), "text/plain; charset=utf-8");
        return true;
      },
    });

    api.registerHttpRoute({
      path: clientScriptPath,
      auth: "plugin",
      match: "exact",
      async handler(_req, res) {
        sendText(res, 200, await clientScript(config), "application/javascript; charset=utf-8");
        return true;
      },
    });

    api.registerHttpRoute({
      path: bookmarkletPath,
      auth: "plugin",
      match: "exact",
      handler(_req, res) {
        sendText(res, 200, bookmarkletHtml(config), "text/html; charset=utf-8");
        return true;
      },
    });
  },
});
