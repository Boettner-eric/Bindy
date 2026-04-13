const MODIFIER_KEYS = ["Control", "Meta", "Alt", "Shift"];

function formatHotkey(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

function isModifierKey(key) {
  return MODIFIER_KEYS.includes(key);
}
