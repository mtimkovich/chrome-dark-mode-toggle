importScripts('lib.js');
const { originOf, badgeFor, toggleOrigin } = DM;

const KEY = 'overrides';
const OPTIONS_URL = chrome.runtime.getURL('options.html');
// Support is recorded for the options page under a fixed pseudo-origin.
const OPTIONS_ORIGIN = 'options';
const isOptions = (url) => !!url && url.startsWith(OPTIONS_URL);

async function getAll() {
  return (await chrome.storage.sync.get(KEY))[KEY] || {};
}

// --- Per-tab API support, remembered with the origin it was measured on -------
const supKey = (id) => 'support' + id;

async function setSupport(tabId, origin, supported) {
  await chrome.storage.session.set({ [supKey(tabId)]: { origin, supported } });
}

// Returns true/false, or undefined when unknown (and probe is off / fails).
async function getSupport(tabId, origin, probe, force = false) {
  const rec = (await chrome.storage.session.get(supKey(tabId)))[supKey(tabId)];
  if (!force && rec && rec.origin === origin) return rec.supported;
  if (!probe) return undefined;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!(navigator.preferences && navigator.preferences.colorScheme),
    });
    await setSupport(tabId, origin, res.result);
    return res.result;
  } catch { return undefined; } // e.g. restricted page
}

// --- Badge -------------------------------------------------------------------
async function setBadge(tabId, { text, color }) {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
}

async function paint(tabId, url, probe = false) {
  if (isOptions(url)) {
    const { theme } = await chrome.storage.local.get('theme');
    const supported = (await getSupport(tabId, OPTIONS_ORIGIN, false)) !== false;
    return setBadge(tabId, badgeFor(theme, supported));
  }
  const origin = originOf(url);
  if (!origin) return chrome.action.setBadgeText({ tabId, text: '' });
  const supported = (await getSupport(tabId, origin, probe)) !== false;
  const mode = (await getAll())[origin] || 'system';
  return setBadge(tabId, badgeFor(mode, supported));
}

// --- Toolbar button ----------------------------------------------------------
chrome.action.onClicked.addListener(async (tab) => {
  if (isOptions(tab.url)) {
    // Extension pages get no content script; the options page applies 'theme' itself.
    const { theme, system = 'light' } = await chrome.storage.local.get(['theme', 'system']);
    const mode = DM.nextOverride(theme === 'dark' || theme === 'light' ? theme : null, system);
    await chrome.storage.local.set({ theme: mode || 'system' });
    return paint(tab.id, tab.url);
  }
  const origin = originOf(tab.url);
  if (!origin) return;

  if ((await getSupport(tab.id, origin, true)) === false) {
    await paint(tab.id, tab.url);
    return chrome.tabs.create({ url: OPTIONS_URL + '?site=' + encodeURIComponent(origin) });
  }

  const { system = 'light' } = await chrome.storage.local.get('system');
  const all = toggleOrigin(await getAll(), origin, system);
  await chrome.storage.sync.set({ [KEY]: all });
  paint(tab.id, tab.url);
});

// --- Events ------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'checkSite') {
    // Is the API really unavailable on any open tab of this origin? (fresh probe)
    (async () => {
      const tabs = await chrome.tabs.query({ url: msg.site + '/*' });
      const results = await Promise.all(tabs.map((t) => getSupport(t.id, msg.site, true, true)));
      sendResponse({ unsupported: results.includes(false) });
    })().catch(() => sendResponse({ unsupported: false }));
    return true; // async response
  }
  if (msg.type !== 'status') return;
  if (msg.system) chrome.storage.local.set({ system: msg.system });
  if (sender.tab) {
    setSupport(sender.tab.id, isOptions(sender.tab.url) ? OPTIONS_ORIGIN : originOf(sender.tab.url), msg.supported)
      .then(() => paint(sender.tab.id, sender.tab.url));
  }
});

chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (!tab.url) return;
  if (info.status === 'loading') paint(id, tab.url);
  if (info.status === 'complete') paint(id, tab.url, true); // covers tabs opened before install
});

chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(supKey(id)));

// Keep the badge in sync when the theme changes from the options page dropdown.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.theme) return;
  for (const tab of await chrome.tabs.query({ url: OPTIONS_URL + '*' })) paint(tab.id, tab.url);
});
