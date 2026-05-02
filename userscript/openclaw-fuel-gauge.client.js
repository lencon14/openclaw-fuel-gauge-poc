(() => {
  document.getElementById('oc-fuel-btn')?.remove();
  document.getElementById('oc-fuel-panel')?.remove();
  document.getElementById('oc-fuel-style')?.remove();
  window.__openclawFuelGaugePoc = true;

  const ENDPOINT = '/openclaw-fuel-gauge.json';
  const PANEL_URL = '/openclaw-fuel-gauge/';
  const css = `
#oc-fuel-btn{position:fixed!important;right:8px!important;bottom:2px!important;z-index:2147483647!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:999px!important;padding:8px 11px!important;background:#1f2937!important;color:#f9fafb!important;font:700 13px system-ui,sans-serif!important;box-shadow:0 10px 30px rgba(0,0,0,.35)!important;cursor:pointer!important}
#oc-fuel-panel{position:fixed!important;right:8px!important;bottom:50px!important;z-index:2147483647!important;width:min(420px,calc(100vw - 16px))!important;max-height:min(620px,calc(100vh - 64px))!important;overflow:auto!important;background:#111827!important;color:#f9fafb!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:16px!important;box-shadow:0 18px 60px rgba(0,0,0,.45)!important;padding:14px!important;font:13px system-ui,sans-serif!important;display:none!important}
#oc-fuel-panel.oc-open{display:block!important}
#oc-fuel-panel .top{display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:center!important;margin-bottom:10px!important}
#oc-fuel-panel .actions{display:flex!important;gap:6px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important}
#oc-fuel-panel button,#oc-fuel-panel a{border:1px solid rgba(255,255,255,.24)!important;border-radius:999px!important;padding:7px 10px!important;background:#0f172a!important;color:#f9fafb!important;cursor:pointer!important;text-decoration:none!important}
#oc-fuel-panel .muted{color:#cbd5e1!important;font-size:12px!important}
#oc-fuel-panel .note{color:#94a3b8!important;font-size:12px!important;margin-top:3px!important;line-height:1.35!important}
#oc-fuel-panel .card{border:1px solid rgba(255,255,255,.14)!important;border-radius:12px!important;padding:10px!important;margin-top:8px!important;background:#0b1220!important;color:#f9fafb!important}
#oc-fuel-panel .provider{display:flex!important;gap:6px!important;flex-wrap:wrap!important;align-items:baseline!important}
#oc-fuel-panel .provider-name{font-weight:700!important}
#oc-fuel-panel .plan{color:#cbd5e1!important;font-size:12px!important}
#oc-fuel-panel .source-row{display:flex!important;gap:7px!important;flex-wrap:wrap!important;align-items:center!important;margin-top:3px!important;color:#7f8da3!important;font-size:11px!important;line-height:1.4!important}
#oc-fuel-panel .pill{display:inline-flex!important;align-items:center!important;border:1px solid rgba(34,197,94,.42)!important;border-radius:999px!important;padding:1px 7px!important;background:rgba(34,197,94,.14)!important;color:#bbf7d0!important;font-size:10.5px!important;font-weight:650!important;line-height:1.45!important;letter-spacing:.01em!important}
#oc-fuel-panel .pill.stale{border-color:rgba(245,158,11,.55)!important;background:rgba(245,158,11,.16)!important;color:#fde68a!important}
#oc-fuel-panel .window{margin-top:10px!important}
#oc-fuel-panel .window-title{font-weight:700!important}
#oc-fuel-panel .bar{height:8px!important;border-radius:999px!important;overflow:hidden!important;background:#374151!important;margin-top:5px!important}
#oc-fuel-panel .fill{height:100%!important;background:var(--oc-fuel-fill,#22c55e)!important}
#oc-fuel-panel .fill.warn{background:#f59e0b!important}
#oc-fuel-panel .fill.danger{background:#ef4444!important}
#oc-fuel-panel pre{white-space:pre-wrap!important;font-size:11px!important;color:#f9fafb!important}`;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fillClass(left) {
    return left == null ? '' : left < 20 ? 'danger' : left < 50 ? 'warn' : '';
  }

  function fillColor(left) {
    return left == null ? '#22c55e' : left < 20 ? '#ef4444' : left < 50 ? '#f59e0b' : '#22c55e';
  }

  function confidenceClass(confidence) {
    return String(confidence || '').includes('stale') ? 'pill stale' : 'pill';
  }

  function renderWindow(w) {
    const left = w.leftPercent ?? '?';
    const reset = w.resetIn ? ` · reset ${esc(w.resetIn)}` : '';
    const width = Math.max(0, Math.min(100, Number(w.leftPercent) || 0));
    const note = w.note ? `<div class="note">${esc(w.note)}</div>` : '';
    return `<div class="window">
      <div><span class="window-title">${esc(w.label || 'window')}</span>: ${esc(left)}% left${reset}</div>
      <div class="bar"><div class="fill ${fillClass(w.leftPercent)}" style="width:${width}%;--oc-fuel-fill:${fillColor(w.leftPercent)}"></div></div>
      ${note}
    </div>`;
  }

  function renderProvider(p) {
    const wins = (p.windows || []).map(renderWindow).join('') || '<div class="note">No active windows.</div>';
    const plan = p.plan ? `<span class="plan">${esc(p.plan)}</span>` : '';
    const source = p.source || 'unknown source';
    const confidence = p.confidence || 'unknown confidence';
    const note = p.note ? `<div class="note">${esc(p.note)}</div>` : '';
    const error = p.error ? `<pre>${esc(p.error)}</pre>` : '';
    return `<section class="card">
      <div class="provider"><span class="provider-name">${esc(p.name || p.id || 'Unknown')}</span>${plan}</div>
      <div class="source-row"><span>${esc(source)}</span><span class="${confidenceClass(confidence)}">${esc(confidence)}</span></div>
      ${note}${error}${wins}
    </section>`;
  }

  function render(data, out, stamp) {
    stamp.textContent = data.generatedAt ? 'updated ' + new Date(data.generatedAt).toLocaleString() : 'updated';
    const cards = (data.providers || []).map(renderProvider).join('');
    const errors = (data.errors || []).length
      ? `<section class="card"><strong>Errors</strong><pre>${esc(JSON.stringify(data.errors, null, 2))}</pre></section>`
      : '';
    out.innerHTML = cards + errors;
  }

  function ready(fn) {
    document.body ? fn() : addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(() => {
    const st = document.createElement('style');
    st.id = 'oc-fuel-style';
    st.textContent = css;
    document.documentElement.appendChild(st);

    const btn = document.createElement('button');
    btn.id = 'oc-fuel-btn';
    btn.textContent = '⛽ Limits';

    const panel = document.createElement('div');
    panel.id = 'oc-fuel-panel';
    panel.innerHTML = `<div class="top"><div><strong>Fuel Gauge</strong><div id="oc-fuel-stamp" class="muted">Not refreshed yet</div></div><div class="actions"><a href="${PANEL_URL}" target="_blank" rel="noreferrer">Open</a><button id="oc-fuel-refresh">Refresh</button><button id="oc-fuel-close">×</button></div></div><div id="oc-fuel-out" class="muted">Press Refresh to fetch current remaining capacity.</div>`;
    document.body.append(btn, panel);

    const out = panel.querySelector('#oc-fuel-out');
    const stamp = panel.querySelector('#oc-fuel-stamp');
    const refresh = panel.querySelector('#oc-fuel-refresh');

    async function load() {
      refresh.disabled = true;
      refresh.textContent = 'Refreshing…';
      try {
        const res = await fetch(ENDPOINT, { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
        render(await res.json(), out, stamp);
      } catch (e) {
        out.innerHTML = `<section class="card"><strong>Failed</strong><pre>${esc(e.stack || e.message || e)}</pre></section>`;
      } finally {
        refresh.disabled = false;
        refresh.textContent = 'Refresh';
      }
    }

    btn.onclick = () => panel.classList.toggle('oc-open');
    panel.querySelector('#oc-fuel-close').onclick = () => panel.classList.remove('oc-open');
    refresh.onclick = load;
  });
})();
