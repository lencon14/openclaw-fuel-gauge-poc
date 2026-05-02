chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ routePrefix: '' }, (settings) => {
    if (!settings.routePrefix) {
      chrome.storage.sync.set({
        routePrefix: '/openclaw-fuel-gauge',
        position: 'bottom-right',
        compact: false,
        autoRefreshOnOpen: false,
        providers: '',
        windows: '',
      });
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (error) {
    console.error('[OpenClaw Fuel Gauge] inject failed', error);
  }
});
