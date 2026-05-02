(() => {
  const ROOT_ID = 'oc-fuel-ext-root';
  const STYLE_ID = 'oc-fuel-ext-style';
  const DEFAULTS = {
    routePrefix: '/openclaw-fuel-gauge',
    position: 'bottom-right',
    compact: false,
    autoRefreshOnOpen: false,
    providers: '',
    windows: '',
  };

  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    existing.querySelector('.oc-fuel-ext-panel')?.classList.toggle('oc-open');
    return;
  }

  function readSettings() {
    return new Promise((resolve) => {
      if (!globalThis.chrome?.storage?.sync) return resolve({ ...DEFAULTS });
      chrome.storage.sync.get(DEFAULTS, (settings) => resolve({ ...DEFAULTS, ...settings }));
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function cleanRoutePrefix(value) {
    const raw = String(value || DEFAULTS.routePrefix).trim() || DEFAULTS.routePrefix;
    return raw.startsWith('/') ? raw.replace(/\/+$/, '') : '/' + raw.replace(/\/+$/, '');
  }

  function cleanPosition(value) {
    const allowed = new Set(['bottom-right', 'bottom-left', 'top-right', 'top-left']);
    return allowed.has(value) ? value : DEFAULTS.position;
  }

  function csvSet(value) {
    return new Set(String(value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean));
  }

  function isAllowed(set, ...values) {
    if (!set.size) return true;
    return values.some((value) => set.has(String(value || '').toLowerCase()));
  }

  function fillClass(left) {
    return left == null ? '' : left < 20 ? 'danger' : left < 50 ? 'warn' : '';
  }

  function fillColor(left) {
    return left == null ? '#22c55e' : left < 20 ? '#ef4444' : left < 50 ? '#f59e0b' : '#22c55e';
  }

  function confidenceClass(confidence) {
    return String(confidence || '').includes('stale') ? 'oc-pill stale' : 'oc-pill';
  }

  function css(settings) {
    return `
#${ROOT_ID}{all:initial!important;font:13px system-ui,sans-serif!important;color:#f9fafb!important}
#${ROOT_ID} *{box-sizing:border-box!important}
#${ROOT_ID} .oc-fuel-ext-btn{position:fixed!important;z-index:2147483647!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:999px!important;padding:${settings.compact ? '6px 9px' : '8px 11px'}!important;background:#1f2937!important;color:#f9fafb!important;font:700 ${settings.compact ? '12px' : '13px'} system-ui,sans-serif!important;box-shadow:0 10px 30px rgba(0,0,0,.35)!important;cursor:pointer!important}
#${ROOT_ID} .oc-fuel-ext-panel{position:fixed!important;z-index:2147483647!important;width:${settings.compact ? 'min(340px,calc(100vw - 16px))' : 'min(420px,calc(100vw - 16px))'}!important;max-height:min(620px,calc(100vh - 64px))!important;overflow:auto!important;background:#111827!important;color:#f9fafb!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:16px!important;box-shadow:0 18px 60px rgba(0,0,0,.45)!important;padding:${settings.compact ? '10px' : '14px'}!important;font:${settings.compact ? '12px' : '13px'} system-ui,sans-serif!important;display:none!important}
#${ROOT_ID} .oc-fuel-ext-panel.oc-open{display:block!important}
#${ROOT_ID}.oc-pos-bottom-right .oc-fuel-ext-btn{right:8px!important;bottom:2px!important}
#${ROOT_ID}.oc-pos-bottom-right .oc-fuel-ext-panel{right:8px!important;bottom:50px!important}
#${ROOT_ID}.oc-pos-bottom-left .oc-fuel-ext-btn{left:8px!important;bottom:2px!important}
#${ROOT_ID}.oc-pos-bottom-left .oc-fuel-ext-panel{left:8px!important;bottom:50px!important}
#${ROOT_ID}.oc-pos-top-right .oc-fuel-ext-btn{right:8px!important;top:8px!important}
#${ROOT_ID}.oc-pos-top-right .oc-fuel-ext-panel{right:8px!important;top:56px!important}
#${ROOT_ID}.oc-pos-top-left .oc-fuel-ext-btn{left:8px!important;top:8px!important}
#${ROOT_ID}.oc-pos-top-left .oc-fuel-ext-panel{left:8px!important;top:56px!important}
#${ROOT_ID} .oc-top{display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:center!important;margin-bottom:10px!important}
#${ROOT_ID} .oc-actions{display:flex!important;gap:6px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important}
#${ROOT_ID} button,#${ROOT_ID} a{border:1px solid rgba(255,255,255,.24)!important;border-radius:999px!important;padding:7px 10px!important;background:#0f172a!important;color:#f9fafb!important;cursor:pointer!important;text-decoration:none!important;font:inherit!important}
#${ROOT_ID} .oc-muted{color:#cbd5e1!important;font-size:12px!important}
#${ROOT_ID} .oc-note{color:#94a3b8!important;font-size:12px!important;margin-top:3px!important;line-height:1.35!important}
#${ROOT_ID} .oc-card{border:1px solid rgba(255,255,255,.14)!important;border-radius:12px!important;padding:10px!important;margin-top:8px!important;background:#0b1220!important;color:#f9fafb!important}
#${ROOT_ID} .oc-provider{display:flex!important;gap:6px!important;flex-wrap:wrap!important;align-items:baseline!important}
#${ROOT_ID} .oc-provider-name{font-weight:700!important}
#${ROOT_ID} .oc-plan{color:#cbd5e1!important;font-size:12px!important}
#${ROOT_ID} .oc-source-row{display:flex!important;gap:7px!important;flex-wrap:wrap!important;align-items:center!important;margin-top:3px!important;color:#7f8da3!important;font-size:11px!important;line-height:1.4!important}
#${ROOT_ID} .oc-pill{display:inline-flex!important;align-items:center!important;border:1px solid rgba(34,197,94,.42)!important;border-radius:999px!important;padding:1px 7px!important;background:rgba(34,197,94,.14)!important;color:#bbf7d0!important;font-size:10.5px!important;font-weight:650!important;line-height:1.45!important;letter-spacing:.01em!important}
#${ROOT_ID} .oc-pill.stale{border-color:rgba(245,158,11,.55)!important;background:rgba(245,158,11,.16)!important;color:#fde68a!important}
#${ROOT_ID} .oc-window{margin-top:10px!important}
#${ROOT_ID} .oc-window-title{font-weight:700!important}
#${ROOT_ID} .oc-bar{height:8px!important;border-radius:999px!important;overflow:hidden!important;background:#374151!important;margin-top:5px!important}
#${ROOT_ID} .oc-fill{height:100%!important;background:var(--oc-fuel-fill,#22c55e)!important}
#${ROOT_ID} pre{white-space:pre-wrap!important;font-size:11px!important;color:#f9fafb!important}`;
  }

  function renderWindow(windowInfo) {
    const left = windowInfo.leftPercent ?? '?';
    const reset = windowInfo.resetIn ? ` · reset ${esc(windowInfo.resetIn)}` : '';
    const width = Math.max(0, Math.min(100, Number(windowInfo.leftPercent) || 0));
    const note = windowInfo.note ? `<div class="oc-note">${esc(windowInfo.note)}</div>` : '';
    return `<div class="oc-window">
      <div><span class="oc-window-title">${esc(windowInfo.label || 'window')}</span>: ${esc(left)}% left${reset}</div>
      <div class="oc-bar"><div class="oc-fill ${fillClass(windowInfo.leftPercent)}" style="width:${width}%;--oc-fuel-fill:${fillColor(windowInfo.leftPercent)}"></div></div>
      ${note}
    </div>`;
  }

  function renderProvider(provider, windowFilter) {
    const windows = (provider.windows || [])
      .filter((windowInfo) => isAllowed(windowFilter, windowInfo.label))
      .map(renderWindow)
      .join('') || '<div class="oc-note">No matching windows.</div>';
    const plan = provider.plan ? `<span class="oc-plan">${esc(provider.plan)}</span>` : '';
    const source = provider.source || 'unknown source';
    const confidence = provider.confidence || 'unknown confidence';
    const error = provider.error ? `<pre>${esc(provider.error)}</pre>` : '';
    return `<section class="oc-card">
      <div class="oc-provider"><span class="oc-provider-name">${esc(provider.name || provider.id || 'Unknown')}</span>${plan}</div>
      <div class="oc-source-row"><span>${esc(source)}</span><span class="${confidenceClass(confidence)}">${esc(confidence)}</span></div>
      ${error}${windows}
    </section>`;
  }

  function render(data, out, stamp, settings) {
    const providerFilter = csvSet(settings.providers);
    const windowFilter = csvSet(settings.windows);
    stamp.textContent = data.generatedAt ? 'updated ' + new Date(data.generatedAt).toLocaleString() : 'updated';
    const providers = (data.providers || [])
      .filter((provider) => isAllowed(providerFilter, provider.id, provider.name))
      .map((provider) => renderProvider(provider, windowFilter))
      .join('') || '<section class="oc-card"><div class="oc-note">No matching providers.</div></section>';
    const errors = (data.errors || []).length
      ? `<section class="oc-card"><strong>Errors</strong><pre>${esc(JSON.stringify(data.errors, null, 2))}</pre></section>`
      : '';
    out.innerHTML = providers + errors;
  }

  function ready(fn) {
    document.body ? fn() : addEventListener('DOMContentLoaded', fn, { once: true });
  }

  readSettings().then((settings) => ready(() => {
    const routePrefix = cleanRoutePrefix(settings.routePrefix);
    const endpoint = new URL(routePrefix + '.json', location.href).toString();
    const panelUrl = new URL(routePrefix + '/', location.href).toString();

    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css(settings);
    document.documentElement.append(style);

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'oc-pos-' + cleanPosition(settings.position);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oc-fuel-ext-btn';
    button.textContent = '⛽ Limits';

    const panel = document.createElement('div');
    panel.className = 'oc-fuel-ext-panel';
    panel.innerHTML = `<div class="oc-top"><div><strong>Fuel Gauge</strong><div class="oc-fuel-ext-stamp oc-muted">Not refreshed yet</div></div><div class="oc-actions"><a href="${panelUrl}" target="_blank" rel="noreferrer">Open</a><button class="oc-fuel-ext-refresh" type="button">Refresh</button><button class="oc-fuel-ext-close" type="button">×</button></div></div><div class="oc-fuel-ext-out oc-muted">Press Refresh to fetch current remaining capacity.</div>`;

    root.append(button, panel);
    document.body.append(root);

    const out = panel.querySelector('.oc-fuel-ext-out');
    const stamp = panel.querySelector('.oc-fuel-ext-stamp');
    const refresh = panel.querySelector('.oc-fuel-ext-refresh');

    async function load() {
      refresh.disabled = true;
      refresh.textContent = 'Refreshing…';
      try {
        const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + await response.text());
        render(await response.json(), out, stamp, settings);
      } catch (error) {
        out.innerHTML = `<section class="oc-card"><strong>Failed</strong><pre>${esc(error.stack || error.message || error)}</pre></section>`;
      } finally {
        refresh.disabled = false;
        refresh.textContent = 'Refresh';
      }
    }

    button.addEventListener('click', () => {
      panel.classList.toggle('oc-open');
      if (settings.autoRefreshOnOpen && panel.classList.contains('oc-open')) load();
    });
    panel.querySelector('.oc-fuel-ext-close').addEventListener('click', () => panel.classList.remove('oc-open'));
    refresh.addEventListener('click', load);
    panel.classList.add('oc-open');
    if (settings.autoRefreshOnOpen) load();
  }));
})();
