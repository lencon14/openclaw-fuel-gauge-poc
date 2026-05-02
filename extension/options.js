const DEFAULTS = {
  routePrefix: '/openclaw-fuel-gauge',
  position: 'bottom-right',
  compact: false,
  autoRefreshOnOpen: false,
  providers: '',
  windows: '',
};

const fields = {
  routePrefix: document.getElementById('routePrefix'),
  position: document.getElementById('position'),
  compact: document.getElementById('compact'),
  autoRefreshOnOpen: document.getElementById('autoRefreshOnOpen'),
  providers: document.getElementById('providers'),
  windows: document.getElementById('windows'),
};
const status = document.getElementById('status');

function normalizeRoutePrefix(value) {
  const raw = String(value || DEFAULTS.routePrefix).trim() || DEFAULTS.routePrefix;
  return raw.startsWith('/') ? raw.replace(/\/+$/, '') : '/' + raw.replace(/\/+$/, '');
}

function normalizePosition(value) {
  return Array.from(fields.position.options).some((option) => option.value === value)
    ? value
    : DEFAULTS.position;
}

function setStatus(message) {
  status.textContent = message;
  if (message) setTimeout(() => { status.textContent = ''; }, 2200);
}

function readForm() {
  return {
    routePrefix: normalizeRoutePrefix(fields.routePrefix.value),
    position: normalizePosition(fields.position.value),
    compact: fields.compact.checked,
    autoRefreshOnOpen: fields.autoRefreshOnOpen.checked,
    providers: fields.providers.value.trim(),
    windows: fields.windows.value.trim(),
  };
}

function writeForm(settings) {
  fields.routePrefix.value = settings.routePrefix || DEFAULTS.routePrefix;
  fields.position.value = normalizePosition(settings.position);
  fields.compact.checked = Boolean(settings.compact);
  fields.autoRefreshOnOpen.checked = Boolean(settings.autoRefreshOnOpen);
  fields.providers.value = settings.providers || '';
  fields.windows.value = settings.windows || '';
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (settings) => writeForm({ ...DEFAULTS, ...settings }));
}

document.getElementById('save').addEventListener('click', () => {
  const settings = readForm();
  chrome.storage.sync.set(settings, () => {
    writeForm(settings);
    setStatus('Saved. Re-click the extension icon on an OpenClaw tab to use updated settings.');
  });
});

document.getElementById('reset').addEventListener('click', () => {
  chrome.storage.sync.set(DEFAULTS, () => {
    writeForm(DEFAULTS);
    setStatus('Defaults restored.');
  });
});

load();
