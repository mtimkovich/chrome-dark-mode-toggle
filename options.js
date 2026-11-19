const KEY = 'overrides';
const list = document.getElementById('list');

const getAll = async () => (await chrome.storage.sync.get(KEY))[KEY] || {};
const getAdded = async () => (await chrome.storage.sync.get('addedAt')).addedAt || {};
const save = async (all) => {
  const before = await getAll();
  const added = DM.syncAddedAt(await getAdded(), before, all, Date.now());
  await chrome.storage.sync.set({ [KEY]: all, addedAt: added });
};

async function render() {
  const all = await getAll();
  const origins = DM.sortOrigins(Object.keys(all), await getAdded());
  list.replaceChildren();
  if (!origins.length) {
    list.innerHTML = '<tr><td class="empty">No overridden sites yet.</td></tr>';
    return;
  }
  for (const origin of origins) {
    const tr = list.insertRow();
    tr.insertCell().textContent = origin;

    const sel = document.createElement('select');
    for (const v of ['dark', 'light']) sel.add(new Option(v, v, false, all[origin] === v));
    sel.onchange = async () => { const a = await getAll(); a[origin] = sel.value; save(a); };
    tr.insertCell().append(sel);

    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.onclick = async () => { const a = await getAll(); delete a[origin]; await save(a); };
    tr.insertCell().append(del);
  }
}

document.getElementById('clear').onclick = () => {
  if (confirm('Remove all saved sites?')) save({});
};
chrome.storage.onChanged.addListener((_, area) => area === 'sync' && render());
render();

// Warn when the Web Preferences API isn't exposed (this page is a secure context).
document.getElementById('warning').hidden = DM.isSupported(navigator);
if (!DM.isSupported(navigator)) {
  document.getElementById('flags').onclick = (e) => {
    e.preventDefault();
    // chrome:// links can't be followed from an extension page; open via the tabs API.
    chrome.tabs.create({ url: 'chrome://flags/#enable-experimental-web-platform-features' });
  };
}

// Theme for this page itself, driven by the Web Preferences API.
const pref = navigator.preferences && navigator.preferences.colorScheme;
const themeSel = document.getElementById('theme');
if (pref) {
  const sync = () => { themeSel.value = pref.override ?? 'system'; };
  const apply = async (mode) => {
    try {
      if (mode === 'dark' || mode === 'light') await pref.requestOverride(mode);
      else if (pref.override !== null) await pref.clearOverride();
    } catch (e) { console.warn('[dark-mode-toggle] theme override failed', e); }
    sync();
  };
  themeSel.onchange = () => {
    const mode = themeSel.value;
    chrome.storage.local.set({ theme: mode });
    apply(mode);
  };
  pref.addEventListener('change', sync); // also fires if something else overrides
  // Remember the real system scheme (before any override) for the toolbar toggle.
  if (pref.override === null) chrome.storage.local.set({ system: pref.value });
  chrome.storage.local.get('theme').then(({ theme }) => apply(theme));
  // The toolbar button changes 'theme' while this page is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) apply(changes.theme.newValue);
  });
} else {
  themeSel.disabled = true;
}

// Opened from the toolbar button on a page where the API is missing.
// Only show the banner while that site is verifiably still unsupported.
const site = new URLSearchParams(location.search).get('site');
const insecure = document.getElementById('insecure');
async function refreshInsecure() {
  let show = false;
  if (site && DM.isSupported(navigator)) {
    try { show = (await chrome.runtime.sendMessage({ type: 'checkSite', site }))?.unsupported; } catch {}
  }
  insecure.hidden = !show;
  if (show) document.getElementById('site').textContent = site;
}
document.getElementById('insecure-flag').onclick = (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://flags/#unsafely-treat-insecure-origin-as-secure' });
};
refreshInsecure();
addEventListener('focus', refreshInsecure); // re-check when you come back from the flags page

// Let the background worker badge this tab N/A when the API is missing.
chrome.runtime.sendMessage({ type: 'status', supported: DM.isSupported(navigator) }).catch(() => {});
