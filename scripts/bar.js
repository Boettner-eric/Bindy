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

function renderBar(bar, defaults, bindingsForPage) {
  bar.textContent = "";

  const all = [
    ...(defaults || []).map((b) => ({ ...b, isDefault: true })),
    ...(bindingsForPage || []),
  ];
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
