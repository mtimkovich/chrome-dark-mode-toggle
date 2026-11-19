// Pure helpers shared by the background worker, options page and tests.
(function (root) {
  const BADGE = { system: '', dark: 'D', light: 'L' };

  function originOf(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
    } catch { return null; }
  }

  // Toggle: no override -> opposite of system; any override -> back to system (null).
  function nextOverride(current, system) {
    if (current) return null;
    return system === 'dark' ? 'light' : 'dark';
  }

  function badgeFor(mode, supported) {
    if (!supported) return { text: 'N/A', color: '#c00' };
    return { text: BADGE[mode || 'system'] ?? '', color: '#444' };
  }

  // Applies a toggle to the overrides map; returns a new map.
  function toggleOrigin(all, origin, system) {
    const next = { ...all };
    const mode = nextOverride(next[origin], system);
    if (mode) next[origin] = mode; else delete next[origin];
    return next;
  }

  function isSupported(nav) {
    return !!(nav && nav.preferences && nav.preferences.colorScheme);
  }

  // Keeps the origin -> timestamp map in step with an overrides change:
  // stamps newly added origins, drops removed ones, leaves mode changes alone.
  function syncAddedAt(addedAt, before, after, now) {
    const next = { ...addedAt };
    for (const o of Object.keys(after)) if (!(o in before) || next[o] == null) next[o] = now;
    for (const o of Object.keys(next)) if (!(o in after)) delete next[o];
    return next;
  }

  // Most recently added first; sites with no timestamp (older saves) sink, A-Z.
  function sortOrigins(origins, addedAt) {
    return [...origins].sort((a, b) => ((addedAt[b] || 0) - (addedAt[a] || 0)) || a.localeCompare(b));
  }

  root.DM = { syncAddedAt, sortOrigins, originOf, nextOverride, badgeFor, toggleOrigin, isSupported };
})(globalThis);
