// ==UserScript==
// @name         OpenClaw Fuel Gauge Loader
// @namespace    https://openclaw.ai/
// @version      0.1.0
// @description  Loads the latest OpenClaw Fuel Gauge UI from the local OpenClaw plugin route.
// @match        http://127.0.0.1/*
// @match        http://localhost/*
// @match        https://*.ts.net/*
// @grant        none
// ==/UserScript==
(() => {
  const src = `/openclaw-fuel-gauge.client.js?t=${Date.now()}`;
  const old = document.getElementById('oc-fuel-client-script');
  if (old) old.remove();
  window.__openclawFuelGaugePoc = false;
  const s = document.createElement('script');
  s.id = 'oc-fuel-client-script';
  s.src = src;
  s.async = true;
  document.documentElement.appendChild(s);
})();
