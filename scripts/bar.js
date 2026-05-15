function createBar() {
  const bar = document.createElement("div");
  bar.className = "bindy-bar";
  bar.tabIndex = -1;
  return bar;
}

function createFocusTrap() {
  const trap = document.createElement("div");
  trap.className = "bindy-focus-trap";
  trap.tabIndex = -1;
  return trap;
}

const MODE_ORDER = { pinned: 0, focused: 1, background: 2 };

function hasMainModifier(hotkey) {
  return /^(ctrl|cmd|meta)\+/.test(hotkey);
}

function sortBindings(bindings) {
  return [...bindings].sort((a, b) => {
    const modeA = MODE_ORDER[a.mode] ?? 1;
    const modeB = MODE_ORDER[b.mode] ?? 1;
    if (modeA !== modeB) return modeA - modeB;
    const modA = hasMainModifier(a.hotkey) ? 1 : 0;
    const modB = hasMainModifier(b.hotkey) ? 1 : 0;
    if (modA !== modB) return modA - modB;
    return a.hotkey.localeCompare(b.hotkey);
  });
}

function renderBar(bar, defaults, bindingsForPage) {
  bar.textContent = "";

  const all = sortBindings([
    ...(defaults || []).map((b) => ({ ...b, isDefault: true })),
    ...(bindingsForPage || []),
  ]);

  const pinned = all.filter((b) => b.mode === "pinned");
  const unpinned = all.filter((b) => b.mode !== "pinned");

  for (const b of pinned) {
    bar.appendChild(makeChip(b));
  }

  if (unpinned.length > 0) {
    const sep = document.createElement("span");
    sep.className = "bindy-chip-sep";
    sep.setAttribute("aria-hidden", "true");
    bar.appendChild(sep);

    for (const b of unpinned) {
      bar.appendChild(makeChip(b));
    }
  }
}

function makeChip(b) {
  const chip = document.createElement("span");
  let cls = "bindy-chip";
  if (b.isDefault) cls += " bindy-chip--default";
  if (b.mode === "focused") cls += " bindy-chip--focused";
  if (b.mode !== "pinned") cls += " bindy-chip--unpinned";
  if (b.type === "autoClick") cls += b.autoActive ? " bindy-chip--auto-on" : " bindy-chip--auto-off";
  chip.className = cls;
  chip.textContent = b.name ? `[${b.hotkey}] ${b.name}` : `[${b.hotkey}]`;
  return chip;
}

function setBarHidden(bar, hidden) {
  bar.classList.toggle("bindy-bar--hidden", hidden);
}

function setBarActive(bar, active) {
  bar.classList.toggle("bindy-bar--active", active);
}

function createDirections() {
  const el = document.createElement("div");
  el.className = "bindy-directions bindy-directions--hidden";
  return el;
}

function showDirections(el, text) {
  el.textContent = text;
  el.classList.remove("bindy-directions--hidden");
}

function hideDirections(el) {
  el.classList.add("bindy-directions--hidden");
}
