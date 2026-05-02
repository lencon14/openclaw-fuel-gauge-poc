# OpenClaw Fuel Gauge browser extension

Optional unpacked browser-extension UI for the OpenClaw Fuel Gauge plugin.

This extension does **not** read provider credentials. It only injects UI into the active tab when you click the extension icon, then fetches the existing Gateway-authenticated plugin route from that page's origin:

```text
/openclaw-fuel-gauge.json
```

## Local install in Chrome / Edge

1. Make sure the OpenClaw Fuel Gauge plugin is installed and the Gateway route works.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

   ```text
   extension/
   ```

6. Open the OpenClaw Control UI.
7. Click the extension icon to inject the `⛽ Limits` overlay.

## Options

Open the extension options page to configure:

- route prefix;
- button position;
- compact mode;
- provider filter;
- window filter;
- optional refresh-on-open.

## Permissions

The extension uses:

- `activeTab` — inject only into the tab where you click the extension icon;
- `scripting` — run the overlay content script;
- `storage` — save UI preferences.

There are no host permissions and no background polling.

## Automated smoke test

From the repository root:

```bash
npm run test:extension
```

The test launches a temporary Chromium page through the Chrome DevTools Protocol, injects the overlay, fetches a fixture `/openclaw-fuel-gauge.json`, verifies rendered provider/source/confidence data, and writes `.tmp/extension-smoke.png`.
