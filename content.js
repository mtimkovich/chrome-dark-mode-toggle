// Applies the stored per-origin override via the Web Preferences API
// (navigator.preferences.colorScheme). The override is not persisted by
// Chrome, so it is re-applied on every document start.
const KEY = 'overrides';
const origin = location.origin;
const pref = navigator.preferences && navigator.preferences.colorScheme;

async function apply(mode) {
  if (!pref) return;
  try {
    if (mode === 'dark' || mode === 'light') {
      await pref.requestOverride(mode);
    } else if (pref.override !== null) {
      await pref.clearOverride();
    }
  } catch (e) {
    console.warn('[dark-mode-toggle] override failed', e);
  }
}

function report() {
  if (window !== top) return;
  chrome.runtime.sendMessage({ type: 'status', supported: !!pref, system: pref && pref.override === null ? pref.value : undefined }).catch(() => {});
}

chrome.storage.sync.get(KEY).then(({ [KEY]: all = {} }) => apply(all[origin]));
report();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[KEY]) apply((changes[KEY].newValue || {})[origin]);
});
