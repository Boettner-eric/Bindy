const DEFAULT_BINDINGS = [
  {
    hotkey: "ctrl+b",
    type: "toggleBindingMode",
    name: "bind",
    builtin: true,
    mode: "pinned",
  },
  {
    hotkey: "ctrl+e",
    type: "editBinding",
    name: "edit",
    builtin: true,
    mode: "pinned",
  },
  {
    hotkey: "ctrl+f",
    type: "focusBar",
    name: "focus bar",
    builtin: true,
    mode: "pinned",
  },
  {
    hotkey: "ctrl+h",
    type: "toggleBarHidden",
    name: "hide bar",
    builtin: true,
    mode: "pinned",
  },
  {
    hotkey: "ctrl+s",
    type: "openSettings",
    name: "settings",
    builtin: true,
    mode: "pinned",
  },
];

function splitBindings(allBindings) {
  const overrides = {};
  const userBindings = [];
  for (const b of allBindings) {
    if (b.builtin) {
      overrides[b.type] = b;
    } else {
      userBindings.push(b);
    }
  }
  const defaults = DEFAULT_BINDINGS.map((b) => {
    const o = overrides[b.type];
    if (!o) return b;
    return { ...b, ...o, hotkey: o.hotkey || b.hotkey };
  });
  return { defaults, userBindings };
}

function initTopFrame() {
  let bindingMode = false;
  let awaitingClick = null;
  let selectedElement = null;
  let pageBindings = [];
  let effectiveDefaults = [...DEFAULT_BINDINGS];
  let barWasHidden = false;
  function getPagePath() {
    return `${window.location.host}${window.location.pathname}`;
  }

  function handleNavigation() {
    getBindings(getPagePath()).then(applyBindings);
  }

  if (window.navigation) {
    window.navigation.addEventListener("navigatesuccess", handleNavigation);
  } else {
    window.addEventListener("popstate", handleNavigation);
  }

  const bar = createBar();
  const directions = createDirections();
  const focusTrap = createFocusTrap();

  function applyBindings(allBindings) {
    const split = splitBindings(allBindings);
    effectiveDefaults = split.defaults;
    pageBindings = split.userBindings;
    renderBar(bar, effectiveDefaults, pageBindings);
  }

  async function loadInitialState() {
    const [allBindings, hidden, theme, layout] = await Promise.all([
      getBindings(getPagePath()),
      getBarHidden(),
      getTheme(),
      getLayout(),
    ]);
    applyBindings(allBindings);
    setBarHidden(bar, hidden);
    applyTheme(theme);
    applyLayout(bar, layout);
  }

  loadInitialState();

  onBarHiddenChange((hidden) => setBarHidden(bar, hidden));
  onBindingsChange(applyBindings);
  onThemeChange((theme) => applyTheme(theme));
  onLayoutChange((layout) => applyLayout(bar, layout));

  function clearSelection() {
    if (selectedElement) {
      selectedElement.classList.remove("bindy-selected");
      selectedElement = null;
    }
  }

  function toggleBindingMode() {
    bindingMode = !bindingMode;
    notifyIframesBindingMode(bindingMode);
    setBarActive(bar, bindingMode);
    if (!bindingMode) {
      awaitingClick = null;
      clearSelection();
      closeHotkeyModal();
      hideDirections(directions);
      renderBar(bar, effectiveDefaults, pageBindings);
    } else {
      startBindFlow();
    }
  }

  async function startBindFlow() {
    const result = await openTypePickerModal();
    if (!result) {
      if (bindingMode) toggleBindingMode();
      return;
    }

    if (result.needsElement) {
      awaitingClick = { bindingType: result.bindingType };
      showDirections(directions, "Click an element · Esc to cancel");
    } else {
      await addBinding(result.scope, result);
      if (bindingMode) toggleBindingMode();
    }
  }

  async function handleClick(e) {
    if (!bindingMode || !awaitingClick) return;
    const target = findInteractiveAncestor(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    if (awaitingClick.onAltElement) {
      const { onAltElement } = awaitingClick;
      awaitingClick = null;
      clearSelection();
      selectedElement = target;
      target.classList.add("bindy-selected");
      showDirections(directions, "Alternate element captured");
      onAltElement(target);
      return;
    }

    const { bindingType } = awaitingClick;
    awaitingClick = null;

    clearSelection();
    selectedElement = target;
    target.classList.add("bindy-selected");

    const result = await openElementModal(target, bindingType, getPagePath(), {
      onNeedsAlt(onAltElement) {
        awaitingClick = { onAltElement };
        notifyIframesBindingMode(true);
        showDirections(directions, "Click the alternate element");
      },
    });
    clearSelection();
    if (result) {
      await addBinding(result.scope, result);
    }
    if (bindingMode) toggleBindingMode();
  }

  async function handleIframeElementPicked({ selector, iframeSelector }) {
    if (!bindingMode || !awaitingClick) return;

    if (awaitingClick.onAltElement) {
      const { onAltElement } = awaitingClick;
      awaitingClick = null;
      showDirections(directions, "Alternate element captured");
      onAltElement({ selector, iframeSelector });
      return;
    }

    const { bindingType } = awaitingClick;
    awaitingClick = null;

    const result = await openElementModal({ selector, iframeSelector }, bindingType, getPagePath(), {
      onNeedsAlt(onAltElement) {
        awaitingClick = { onAltElement };
        notifyIframesBindingMode(true);
        showDirections(directions, "Click the alternate element");
      },
    });
    clearSelection();
    if (result) {
      await addBinding(result.scope, result);
    }
    if (bindingMode) toggleBindingMode();
  }

  async function editBindings() {
    await openEditModal(pageBindings, effectiveDefaults, DEFAULT_BINDINGS);
  }

  function focusBar() {
    if (document.activeElement === bar) {
      bar.blur();
    } else {
      bar.focus({ preventScroll: true });
    }
  }

  function doToggleBarHidden() {
    const temporarilyShown = document.activeElement === bar && bar.classList.contains("bindy-bar--hidden");
    bar.blur();
    if (!temporarilyShown) toggleBarHidden();
  }

  const ctx = { toggleBindingMode, editBindings, focusBar, toggleBarHidden: doToggleBarHidden };

  function handleKeys(e) {
    if (activeModal) return;

    if (bindingMode && awaitingClick && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      toggleBindingMode();
      return;
    }

    if (isTypingTarget(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) return;

    const barFocused = document.activeElement === bar;

    if (barFocused && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      bar.blur();
      return;
    }

    // While in binding mode, disable all bindings
    const candidates = bindingMode
      ? []
      : [
          ...filterByMode(effectiveDefaults, barFocused),
          ...filterByMode(pageBindings, barFocused),
        ];

    const match = findMatchingBinding(candidates, e);
    if (!match) return;
    if (executeBinding(match, ctx)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function filterByMode(bindings, barFocused) {
    return bindings.filter((b) => {
      if (b.type === "focusBar") return true;
      if (b.mode === "focused") return barFocused;
      return true;
    });
  }

  // Click bar to deliberately focus it (activates focused-mode bindings)
  bar.addEventListener("click", () => {
    bar.focus({ preventScroll: true });
  });

  function mount() {
    if (!document.body) return;
    document.body.appendChild(bar);
    document.body.appendChild(directions);
    document.body.appendChild(focusTrap);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeys, true);
  onIframeElementPicked(handleIframeElementPicked);

  window.addEventListener("message", (evt) => {
    const msg = evt.data;
    if (!msg || msg.type !== "bindy-keydown") return;
    handleKeys({
      key: msg.key,
      ctrlKey: msg.ctrlKey,
      metaKey: msg.metaKey,
      shiftKey: msg.shiftKey,
      altKey: msg.altKey,
      target: document.body,
      preventDefault() {},
      stopPropagation() {},
    });
  });

  // After cmd+tab, focus the invisible trap so keydown events reach the
  // document without activating focused-mode bindings on the bar.
  window.addEventListener("focus", () => {
    const ae = document.activeElement;
    if (!ae || ae === document.body || ae === document.documentElement) {
      focusTrap.focus({ preventScroll: true });
    }
  });
}

function init() {
  if (window.top !== window) {
    initChildFrame();
  } else {
    initTopFrame();
  }
}

init();
