const THEMES_DATA = [
  { name: "Skeletor", bg: "#2b2836", bgDeep: "#1e1c26", text: "#dce7fd", muted: "#655e7f", accent: "#bd93f9", accentGlow: "rgba(189,147,249,0.4)", highlight: "#3b3750" },
  { name: "Dracula", bg: "#282a36", bgDeep: "#1e1f29", text: "#f8f8f2", muted: "#6272a4", accent: "#50fa7b", accentGlow: "rgba(80,250,123,0.4)", highlight: "#44475a" },
  { name: "Nord", bg: "#2e3440", bgDeep: "#242933", text: "#eceff4", muted: "#4c566a", accent: "#88c0d0", accentGlow: "rgba(136,192,208,0.4)", highlight: "#3b4252" },
  { name: "Monokai", bg: "#272822", bgDeep: "#1e1f1c", text: "#f8f8f2", muted: "#75715e", accent: "#f92672", accentGlow: "rgba(249,38,114,0.4)", highlight: "#3e3d32" },
  { name: "Solarized", bg: "#002b36", bgDeep: "#001f27", text: "#93a1a1", muted: "#586e75", accent: "#b58900", accentGlow: "rgba(181,137,0,0.4)", highlight: "#073642" },
  { name: "Rosé Pine", bg: "#191724", bgDeep: "#13111e", text: "#e0def4", muted: "#6e6a86", accent: "#ebbcba", accentGlow: "rgba(235,188,186,0.4)", highlight: "#26233a" },
];

const BINDING_TYPES = ["click", "sequence", "autoClick", "emulate", "hint", "scroll", "blur", "toggleBindingMode", "toggleBarHidden", "editBinding", "focusBar", "changeTheme", "changeLayout", "openSettings"];

const DEFAULT_NAMES = {
  toggleBindingMode: "bind",
  editBinding: "edit",
  focusBar: "focus bar",
  toggleBarHidden: "hide bar",
  openSettings: "settings",
  changeTheme: "change theme",
  changeLayout: "change layout",
  blur: "blur",
  scroll: "scroll",
  emulate: "emulate key",
  hint: "hint",
  autoClick: "auto click",
};

function bindingName(b) {
  return b.name || DEFAULT_NAMES[b.type] || b.type || "";
}
const MODE_OPTIONS = ["pinned", "background", "focused"];

const BUILTIN_SCOPE = "__builtin__";

const DEFAULT_BINDINGS = [
  { hotkey: "ctrl+b", type: "toggleBindingMode", name: "bind", builtin: true, mode: "pinned" },
  { hotkey: "ctrl+e", type: "editBinding", name: "edit", builtin: true, mode: "pinned" },
  { hotkey: "ctrl+f", type: "focusBar", name: "focus bar", builtin: true, mode: "pinned" },
  { hotkey: "ctrl+h", type: "toggleBarHidden", name: "hide bar", builtin: true, mode: "pinned" },
  { hotkey: "ctrl+s", type: "openSettings", name: "settings", builtin: true, mode: "pinned" },
];

function resolveTheme(name) {
  return THEMES_DATA.find(t => t.name === name) || null;
}

function applyTheme(name) {
  const theme = resolveTheme(name);
  const el = document.documentElement;
  if (!theme) {
    el.classList.add("bindy-theme-arc");
    for (const p of ["--bg","--bg-deep","--text","--muted","--accent","--accent-glow","--highlight"]) {
      el.style.removeProperty(p);
    }
    return;
  }
  el.classList.remove("bindy-theme-arc");
  el.style.setProperty("--bg", theme.bg);
  el.style.setProperty("--bg-deep", theme.bgDeep);
  el.style.setProperty("--text", theme.text);
  el.style.setProperty("--muted", theme.muted);
  el.style.setProperty("--accent", theme.accent);
  el.style.setProperty("--accent-glow", theme.accentGlow);
  el.style.setProperty("--highlight", theme.highlight);
}

function storageGet(defaults) {
  return new Promise(resolve => chrome.storage.local.get(defaults, resolve));
}

function storageSet(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

function formatHotkeyEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

function isModifier(key) {
  return ["control","alt","shift","meta"].includes(key.toLowerCase());
}

// --- State ---
const state = {
  bindings: {},
  selectedScope: null,
  editingBinding: null,
};

// --- Init ---
async function init() {
  const data = await storageGet({ bindings: {}, theme: "Skeletor", layout: "sidebar" });
  state.bindings = data.bindings || {};

  applyTheme(data.theme);

  const themeSelect = document.getElementById("theme-select");
  const layoutSelect = document.getElementById("layout-select");
  themeSelect.value = data.theme;
  layoutSelect.value = data.layout;

  themeSelect.addEventListener("change", () => {
    storageSet({ theme: themeSelect.value });
    applyTheme(themeSelect.value);
  });
  layoutSelect.addEventListener("change", () => storageSet({ layout: layoutSelect.value }));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.bindings) {
      state.bindings = changes.bindings.newValue || {};
      renderScopeList();
      if (state.selectedScope !== null) {
        if (state.selectedScope !== BUILTIN_SCOPE) {
          const hasNonBuiltin = (state.bindings[state.selectedScope] || []).some(b => !b.builtin);
          if (!hasNonBuiltin) {
            state.selectedScope = sortedScopes().find(s => s !== BUILTIN_SCOPE) || BUILTIN_SCOPE;
            closeEditPanel();
          }
        }
        renderBindings();
      }
    }
    if (changes.theme) {
      themeSelect.value = changes.theme.newValue;
      applyTheme(changes.theme.newValue);
    }
    if (changes.layout) {
      layoutSelect.value = changes.layout.newValue;
    }
  });

  document.addEventListener("click", (e) => {
    if (!state.editingBinding) return;
    if (!e.target.closest(".binding-row") && !e.target.closest("#edit-panel")) {
      closeEditPanel();
    }
  });

  renderScopeList();
  autoSelectScope();
}

function autoSelectScope() {
  const scopes = sortedScopes();
  const firstUser = scopes.find(s => s !== BUILTIN_SCOPE);
  selectScope(firstUser || BUILTIN_SCOPE);
}

function sortedScopes() {
  const user = Object.keys(state.bindings)
    .filter(scope => (state.bindings[scope] || []).some(b => !b.builtin))
    .sort((a, b) => {
      if (a === "/") return -1;
      if (b === "/") return 1;
      return a.localeCompare(b);
    });
  return [BUILTIN_SCOPE, ...user];
}

function effectiveDefaults() {
  const overrides = {};
  for (const b of state.bindings["/"] || []) {
    if (b.builtin) overrides[b.type] = b;
  }
  return DEFAULT_BINDINGS.map(d => {
    const o = overrides[d.type];
    if (!o) return d;
    return { ...d, ...o, hotkey: o.hotkey || d.hotkey };
  });
}

// --- Scope list ---
function renderScopeList() {
  const list = document.getElementById("scope-list");
  list.innerHTML = "";
  const scopes = sortedScopes();

  for (const scope of scopes) {
    const count = scope === BUILTIN_SCOPE ? DEFAULT_BINDINGS.length : (state.bindings[scope] || []).filter(b => !b.builtin).length;
    const item = document.createElement("div");
    item.className = "scope-item" + (scope === state.selectedScope ? " scope-item--active" : "");

    const label = document.createElement("span");
    label.className = "scope-label";
    label.textContent = scopeLabel(scope);

    const badge = document.createElement("span");
    badge.className = "scope-badge";
    badge.textContent = count;

    item.appendChild(label);
    item.appendChild(badge);
    item.addEventListener("click", () => selectScope(scope));
    list.appendChild(item);
  }
}

function scopeLabel(scope) {
  if (scope === BUILTIN_SCOPE) return "Bindy Defaults";
  if (scope === "/") return "All pages";
  return scope;
}

function scopeHint(scope) {
  if (scope === BUILTIN_SCOPE) return "Default keybinds — active on every page";
  if (scope === "/") return "Active on every page";
  if (scope.endsWith("/")) return `Active on all paths under ${scope}`;
  return `Active on pages starting with ${scope}`;
}

function selectScope(scope) {
  state.selectedScope = scope;
  state.editingBinding = null;
  renderScopeList();
  renderBindings();
  closeEditPanel();
}

// --- Bindings table ---
function renderBindings() {
  const scope = state.selectedScope;
  const placeholder = document.getElementById("bindings-placeholder");
  const table = document.getElementById("bindings-table");
  const titleEl = document.getElementById("scope-title");
  const hintEl = document.getElementById("scope-hint");

  if (!scope) {
    placeholder.textContent = "Select a page from the sidebar";
    placeholder.style.display = "";
    table.style.display = "none";
    titleEl.textContent = "Select a page";
    hintEl.textContent = "";
    return;
  }

  const isBuiltin = scope === BUILTIN_SCOPE;
  const bindings = isBuiltin
    ? effectiveDefaults()
    : (state.bindings[scope] || []).filter(b => !b.builtin);
  titleEl.textContent = scopeLabel(scope);
  hintEl.textContent = scopeHint(scope);

  const tbody = document.getElementById("bindings-body");
  tbody.innerHTML = "";

  if (!bindings.length) {
    placeholder.textContent = "No bindings for this scope";
    placeholder.style.display = "";
    table.style.display = "none";
    return;
  }

  placeholder.style.display = "none";
  table.style.display = "";

  for (const b of bindings) {
    const row = tbody.insertRow();
    row.className = "binding-row";

    const isEditing = isBuiltin
      ? state.editingBinding?.type === b.type && state.editingBinding?.scope === BUILTIN_SCOPE
      : state.editingBinding?.hotkey === b.hotkey && state.editingBinding?.scope === scope;
    if (isEditing) row.classList.add("binding-row--active");

    const hotkeyTd = row.insertCell();
    hotkeyTd.className = "col-hotkey";
    const chip = document.createElement("span");
    chip.className = "hotkey-chip";
    chip.textContent = b.hotkey;
    hotkeyTd.appendChild(chip);

    const nameTd = row.insertCell();
    nameTd.className = "col-name";
    nameTd.textContent = bindingName(b);

    const typeTd = row.insertCell();
    typeTd.className = "col-type";
    typeTd.textContent = b.type || "click";

    const modeTd = row.insertCell();
    modeTd.className = "col-mode";
    modeTd.textContent = b.mode || "";

    const scopeTd = row.insertCell();
    scopeTd.className = "col-scope";
    scopeTd.textContent = isBuiltin ? "all pages" : (b.scope || scope);

    const delTd = row.insertCell();
    delTd.className = "col-del";

    if (isBuiltin) {
      row.addEventListener("click", () => openEditPanel(b, BUILTIN_SCOPE));
    } else {
      const delBtn = document.createElement("button");
      delBtn.className = "del-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteBinding(scope, b.hotkey);
        if (state.editingBinding?.hotkey === b.hotkey) closeEditPanel();
      });
      delTd.appendChild(delBtn);
      row.addEventListener("click", () => openEditPanel(b, scope));
    }
  }
}

// --- Edit panel ---
function openEditPanel(binding, scope) {
  state.editingBinding = { ...binding, scope };
  renderBindings();

  const panel = document.getElementById("edit-panel");
  const body = document.getElementById("edit-panel-body");
  panel.style.display = "";
  body.innerHTML = "";

  const isBuiltinScope = scope === BUILTIN_SCOPE;

  async function save(patch) {
    if (isBuiltinScope) {
      await saveDefaultOverride(binding.type, patch);
    } else {
      await patchBinding(scope, binding.hotkey, patch);
    }
  }

  // Name field
  body.appendChild(makeField("Name", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = bindingName(binding);
    input.addEventListener("change", async () => {
      await save({ name: input.value.trim() || binding.name });
    });
    return input;
  }));

  // Hotkey field
  let currentHotkey = binding.hotkey;
  body.appendChild(makeField("Hotkey", () => {
    const capture = document.createElement("div");
    capture.className = "hotkey-capture";
    capture.textContent = currentHotkey;
    capture.tabIndex = 0;

    let capturing = false;

    function startCapture() {
      if (capturing) return;
      capturing = true;
      capture.classList.add("hotkey-capture--capturing");
      capture.textContent = "press key…";

      function onKey(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isModifier(e.key)) return;
        if (e.key === "Escape") {
          capture.textContent = currentHotkey;
          capture.classList.remove("hotkey-capture--capturing");
          capturing = false;
          document.removeEventListener("keydown", onKey, true);
          return;
        }
        const hotkey = formatHotkeyEvent(e);
        document.removeEventListener("keydown", onKey, true);
        capture.classList.remove("hotkey-capture--capturing");
        capturing = false;
        currentHotkey = hotkey;
        capture.textContent = hotkey;
        save({ hotkey });
        binding = { ...binding, hotkey };
        state.editingBinding = { ...state.editingBinding, hotkey };
      }

      document.addEventListener("keydown", onKey, true);
    }

    capture.addEventListener("click", startCapture);
    capture.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startCapture(); } });
    return capture;
  }, "Click to capture a new key"));

  // Type field — not shown for builtin scope (type is fixed)
  if (!isBuiltinScope) {
    body.appendChild(makeField("Type", () => {
      const sel = document.createElement("select");
      for (const t of BINDING_TYPES) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        if (t === (binding.type || "click")) opt.selected = true;
        sel.appendChild(opt);
      }
      if (binding.type === "sequence") {
        sel.disabled = true;
      } else {
        sel.addEventListener("change", () => save({ type: sel.value }));
      }
      return sel;
    }));
  }

  // Mode field
  body.appendChild(makeField("Mode", () => {
    const sel = document.createElement("select");
    for (const m of MODE_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === binding.mode) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => save({ mode: sel.value }));
    return sel;
  }));

  // Scope field — not shown for builtin scope (always global)
  if (!isBuiltinScope) {
    body.appendChild(makeField("Scope", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = binding.scope || scope;
      input.addEventListener("change", async () => {
        const newScope = input.value.trim();
        if (!newScope || newScope === scope) return;
        await moveBinding(scope, binding.hotkey, newScope);
        state.editingBinding = { ...state.editingBinding, scope: newScope };
        selectScope(newScope);
      });
      return input;
    }, "URL prefix: host/path, host/, or /"));
  }

  // Action button
  const actions = document.createElement("div");
  actions.className = "edit-actions";

  if (isBuiltinScope) {
    const hasOverride = (state.bindings["/"] || []).some(b => b.builtin && b.type === binding.type);
    if (hasOverride) {
      const resetBtn = document.createElement("button");
      resetBtn.className = "btn btn--danger";
      resetBtn.textContent = "Reset to default";
      resetBtn.addEventListener("click", async () => {
        await resetDefaultOverride(binding.type);
        closeEditPanel();
      });
      actions.appendChild(resetBtn);
    }
  } else {
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--danger";
    delBtn.textContent = "Delete binding";
    delBtn.addEventListener("click", async () => {
      await deleteBinding(scope, binding.hotkey);
      closeEditPanel();
    });
    actions.appendChild(delBtn);
  }

  body.appendChild(actions);
}

function makeField(label, inputFn, hint) {
  const field = document.createElement("div");
  field.className = "field";
  const lbl = document.createElement("div");
  lbl.className = "field-label";
  lbl.textContent = label;
  field.appendChild(lbl);
  field.appendChild(inputFn());
  if (hint) {
    const h = document.createElement("div");
    h.className = "field-hint";
    h.textContent = hint;
    field.appendChild(h);
  }
  return field;
}

function closeEditPanel() {
  state.editingBinding = null;
  document.getElementById("edit-panel").style.display = "none";
  renderBindings();
}

// --- Storage mutations ---
async function patchBinding(scope, hotkey, patch) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings[scope] || [];
  const b = list.find(b => b.hotkey === hotkey);
  if (!b) return;
  Object.assign(b, patch);
  await storageSet({ bindings });
}

async function moveBinding(oldScope, hotkey, newScope) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings[oldScope] || [];
  const idx = list.findIndex(b => b.hotkey === hotkey);
  if (idx === -1) return;
  const [b] = list.splice(idx, 1);
  if (!list.length) delete bindings[oldScope];
  else bindings[oldScope] = list;
  const newList = bindings[newScope] || [];
  newList.push({ ...b, scope: newScope });
  bindings[newScope] = newList;
  await storageSet({ bindings });
}

async function deleteBinding(scope, hotkey) {
  const { bindings } = await storageGet({ bindings: {} });
  bindings[scope] = (bindings[scope] || []).filter(b => b.hotkey !== hotkey);
  if (!bindings[scope].length) delete bindings[scope];
  await storageSet({ bindings });
}

async function saveDefaultOverride(type, patch) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings["/"] || [];
  const existing = list.find(b => b.builtin && b.type === type);
  if (existing) {
    Object.assign(existing, patch);
  } else {
    list.push({ type, builtin: true, ...patch });
  }
  bindings["/"] = list;
  await storageSet({ bindings });
}

async function resetDefaultOverride(type) {
  const { bindings } = await storageGet({ bindings: {} });
  bindings["/"] = (bindings["/"] || []).filter(b => !(b.builtin && b.type === type));
  if (!bindings["/"].length) delete bindings["/"];
  await storageSet({ bindings });
}

init();
