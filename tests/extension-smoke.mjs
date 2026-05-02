import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT_JS = readFileSync(join(ROOT, 'extension/content.js'), 'utf8');
const ARTIFACT_DIR = join(ROOT, '.tmp');

const sampleSnapshot = {
  ok: true,
  generatedAt: '2026-05-02T00:00:00.000Z',
  elapsedMs: 123,
  config: {
    collectors: ['openclaw', 'claude-code'],
    timezone: 'Asia/Tokyo',
    locale: 'en-US',
    routePrefix: '/openclaw-fuel-gauge',
  },
  providers: [
    {
      id: 'openai-codex',
      name: 'Codex',
      plan: 'prolite ($0.00)',
      source: 'openclaw status --usage',
      confidence: 'provider-reported',
      windows: [
        { label: '5h', usedPercent: 10, leftPercent: 90, resetAt: '2026-05-02T04:00:00.000Z', resetIn: '4h 0m', resetInMs: 14_400_000 },
        { label: 'Week', usedPercent: 75, leftPercent: 25, resetAt: '2026-05-05T01:00:00.000Z', resetIn: '3d 1h', resetInMs: 262_800_000 },
      ],
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      plan: 'Claude Max',
      source: 'Claude Code OAuth usage endpoint',
      confidence: 'provider-reported',
      windows: [
        { label: '5h', usedPercent: 90, leftPercent: 10, resetAt: '2026-05-02T02:00:00.000Z', resetIn: '2h 0m', resetInMs: 7_200_000 },
        { label: 'Week Sonnet', usedPercent: 0, leftPercent: 100, resetAt: null, resetIn: null, resetInMs: null },
      ],
    },
  ],
  errors: [],
};

function html() {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Fake OpenClaw Control UI</title></head>
<body>
  <main style="font-family: system-ui; padding: 24px;">
    <h1>Fake OpenClaw Control UI</h1>
    <p>This page is used by the extension smoke test.</p>
    <textarea aria-label="message" style="width: 480px; height: 120px;"></textarea>
  </main>
</body>
</html>`;
}

function startFixtureServer() {
  const server = createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400).end('bad request');
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html());
      return;
    }
    if (url.pathname === '/openclaw-fuel-gauge.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(sampleSnapshot));
      return;
    }
    if (url.pathname === '/openclaw-fuel-gauge/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><title>Fuel Gauge Panel</title><h1>Fuel Gauge Panel</h1>');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveServer({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function chromeCandidates() {
  return [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/opt/homebrew/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
}

async function findChrome() {
  for (const candidate of chromeCandidates()) {
    try {
      const { access } = await import('node:fs/promises');
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('No Chromium-based browser found. Set CHROME_BIN to run the extension smoke test.');
}

async function waitForJson(url, timeoutMs = 10_000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolveMessage, rejectMessage } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) rejectMessage(new Error(`${message.error.message}: ${message.error.data || ''}`));
        else resolveMessage(message.result || {});
      }
    });
    await new Promise((resolveOpen, rejectOpen) => {
      this.ws.addEventListener('open', resolveOpen, { once: true });
      this.ws.addEventListener('error', rejectOpen, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolveMessage, rejectMessage });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rejectMessage(new Error(`CDP timeout: ${method}`));
        }
      }, 10_000);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function evaluate(client, expression, { awaitPromise = false } = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
  }
  return result.result?.value;
}

async function main() {
  const chrome = await findChrome();
  const { server, origin } = await startFixtureServer();
  const userDataDir = await mkdtemp(join(tmpdir(), 'openclaw-fuel-gauge-extension-'));
  const remotePort = 9222 + Math.floor(Math.random() * 1000);
  let browser;
  let client;

  try {
    browser = spawn(chrome, [
      `--remote-debugging-port=${remotePort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      `${origin}/`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let browserOutput = '';
    browser.stdout.on('data', (chunk) => { browserOutput += chunk.toString(); });
    browser.stderr.on('data', (chunk) => { browserOutput += chunk.toString(); });

    const version = await waitForJson(`http://127.0.0.1:${remotePort}/json/version`);
    if (!version.webSocketDebuggerUrl) throw new Error('Missing browser websocket URL');

    const pageTarget = await fetch(`http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent(origin + '/')}`, { method: 'PUT' }).then((response) => response.json());
    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Page.bringToFront');

    await evaluate(client, `${CONTENT_JS}\n//# sourceURL=openclaw-fuel-gauge-extension-content.js`);
    await evaluate(client, `document.querySelector('#oc-fuel-ext-root .oc-fuel-ext-refresh').click()`);
    await evaluate(client, `new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const text = document.body.innerText;
        if (text.includes('Claude Code') && text.includes('provider-reported')) return resolve(true);
        if (Date.now() - start > 5000) return reject(new Error('Timed out waiting for rendered provider data: ' + text));
        setTimeout(tick, 50);
      };
      tick();
    })`, { awaitPromise: true });

    const state = await evaluate(client, `(() => {
      const root = document.getElementById('oc-fuel-ext-root');
      const text = root?.innerText || '';
      const windows = Array.from(root.querySelectorAll('.oc-window')).map((node) => ({
        text: node.innerText,
        fill: node.querySelector('.oc-fill')?.style.getPropertyValue('--oc-fuel-fill'),
        width: node.querySelector('.oc-fill')?.style.width,
      }));
      return {
        hasRoot: Boolean(root),
        panelOpen: root?.querySelector('.oc-fuel-ext-panel')?.classList.contains('oc-open'),
        text,
        windows,
      };
    })()`);

    const requiredText = [
      'Fuel Gauge',
      'Codex',
      'Claude Code',
      'openclaw status --usage',
      'Claude Code OAuth usage endpoint',
      'provider-reported',
    ];
    for (const needle of requiredText) {
      if (!state.text.includes(needle)) throw new Error(`Rendered output missing ${JSON.stringify(needle)}`);
    }
    if (!state.hasRoot) throw new Error('Overlay root was not created');
    if (!state.panelOpen) throw new Error('Overlay panel is not open after injection');
    if (!state.windows.some((windowInfo) => windowInfo.text.includes('Week: 25% left') && windowInfo.fill === '#f59e0b')) {
      throw new Error(`Expected Week 25% window to use orange fill; got ${JSON.stringify(state.windows)}`);
    }
    if (!state.windows.some((windowInfo) => windowInfo.text.includes('5h: 10% left') && windowInfo.fill === '#ef4444')) {
      throw new Error(`Expected 5h 10% window to use red fill; got ${JSON.stringify(state.windows)}`);
    }

    const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const screenshotPath = join(ARTIFACT_DIR, 'extension-smoke.png');
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    await evaluate(client, `
      document.getElementById('oc-fuel-ext-root')?.remove();
      document.getElementById('oc-fuel-ext-style')?.remove();
      globalThis.chrome = {
        storage: {
          sync: {
            get(defaults, callback) {
              callback({
                ...defaults,
                position: 'top-left',
                compact: true,
                autoRefreshOnOpen: true,
                providers: 'claude-code',
                windows: '5h'
              });
            }
          }
        }
      };
    `);
    await evaluate(client, `${CONTENT_JS}\n//# sourceURL=openclaw-fuel-gauge-extension-content-filtered.js`);
    await evaluate(client, `new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const root = document.getElementById('oc-fuel-ext-root');
        const text = root?.innerText || '';
        if (text.includes('Claude Code') && text.includes('5h: 10% left')) return resolve(true);
        if (Date.now() - start > 5000) return reject(new Error('Timed out waiting for filtered render: ' + text));
        setTimeout(tick, 50);
      };
      tick();
    })`, { awaitPromise: true });

    const filteredState = await evaluate(client, `(() => {
      const root = document.getElementById('oc-fuel-ext-root');
      return {
        className: root?.className || '',
        text: root?.innerText || '',
        width: root?.querySelector('.oc-fuel-ext-panel') && getComputedStyle(root.querySelector('.oc-fuel-ext-panel')).width,
      };
    })()`);
    if (!filteredState.className.includes('oc-pos-top-left')) {
      throw new Error(`Expected top-left position class; got ${JSON.stringify(filteredState)}`);
    }
    if (!filteredState.text.includes('Claude Code') || !filteredState.text.includes('5h: 10% left')) {
      throw new Error(`Filtered render missing Claude 5h window; got ${JSON.stringify(filteredState)}`);
    }
    if (filteredState.text.includes('Codex') || filteredState.text.includes('Week Sonnet')) {
      throw new Error(`Filtered render included hidden providers/windows; got ${JSON.stringify(filteredState)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      browser: version.Browser,
      origin,
      screenshot: screenshotPath,
      windows: state.windows,
      filtered: {
        className: filteredState.className,
        text: filteredState.text,
      },
    }, null, 2));
  } catch (error) {
    throw error;
  } finally {
    client?.close();
    browser?.kill('SIGTERM');
    await new Promise((resolveWait) => server.close(resolveWait));
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
