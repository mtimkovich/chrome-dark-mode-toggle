# Chrome Per-Site Dark Mode Toggle

This extension allows you to override the value of `prefers-color-scheme` globally in Chrome, and also on a per-origin basis. That way, if a site uses `prefers-color-scheme` in their stylesheet, you can keep your OS in Light Mode while watching a site in Dark Mode (or vice versa).

The override gets stored in the extension’s storage and gets synced to your Chrome profile so the next time you open the tab, the preference will be reapplied.

Because the extension is powered by the [Web Preferences API](https://wicg.github.io/web-preferences-api/), this also means that sites can change the preference through that API, which in turn gets picked up by the extension.

## Installation

1. Enable the API: start Chrome with `--enable-features=WebPreferences`
   (or flip chrome://flags/#enable-experimental-web-platform-features).
2. chrome://extensions → Developer mode → Load unpacked → this folder.
3. Click the toolbar icon on an https site to toggle: system ↔ opposite (D or L badge).
   Red "N/A" badge = API not available.
Manage saved sites: extension Details → Extension options.

## Tests

Serve this folder (python3 -m http.server) and open /tests.html; the tab title shows PASS/FAIL.

## Privacy Policy

**This extension does not collect, transmit, or share any data.**

- **No network requests.** It has no servers, analytics, telemetry, or remote code. Everything runs locally in your browser.
- **What is stored.** The list of sites (origins, e.g. `https://example.com`) where you chose a dark or light override, plus your theme choice for the options page and the last-seen system color scheme. This lives in `chrome.storage.sync` and `chrome.storage.local`. If you're signed in to Chrome with sync on, Chrome may sync the site list across your devices through your Google account; that is Chrome's feature, not ours. The extension keeps no browsing history.
- **Why the permissions are needed.**
  - `http://*/*` and `https://*/*` host access: to run a small script on pages that applies your override via `navigator.preferences.colorScheme`.
  - `storage`: to save your per-site choices.
  - `tabs` and `scripting`: to read the current tab's address for the toolbar badge and check whether the Web Preferences API is available on it. Page content is never read.
- **Removing your data.** Remove sites on the options page ("Remove" or "Clear all"), or uninstall the extension to delete everything it stored.
- **Changes.** Any change to this policy will be made in this README.
