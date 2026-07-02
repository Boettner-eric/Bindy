const fontStyle = document.createElement("style");
fontStyle.textContent = `@font-face {
  font-family: "Bindy Fira Code";
  src: url("${chrome.runtime.getURL("fonts/FiraCode-Regular.woff2")}") format("woff2");
  font-weight: 400;
  font-style: normal;
}`;
document.head.appendChild(fontStyle);

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
  let previousFocus = null;
  let autoObserver = null;
  const autoPresence = new Map();
  function getPagePath() {
    return `${window.location.host}${window.location.pathname}`;
  }

  function handleNavigation() {
    const page = getPagePath();
    getBindings(page).then(applyBindings);
    getSequenceQueue(page).then(fireSequenceQueue);
  }

  if (window.navigation) {
    window.navigation.addEventListener("navigatesuccess", handleNavigation);
  } else {
    window.addEventListener("popstate", handleNavigation);
  }

  const bar = createBar();
  const directions = createDirections();
  const focusTrap = createFocusTrap();

  function syncAutoObserver() {
    const active = pageBindings.filter(
      (b) => b.type === "autoClick" && b.autoActive,
    );

    if (autoObserver) {
      autoObserver.disconnect();
      autoObserver = null;
    }

    for (const key of autoPresence.keys()) {
      if (!active.some((b) => b.selector === key)) autoPresence.delete(key);
    }

    if (active.length === 0) return;

    const observerOpts = { childList: true, subtree: true, attributes: true };
    const observedRoots = new Set();

    function observeRoot(root) {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      autoObserver.observe(root, observerOpts);
    }

    function getDocForBinding(b) {
      if (!b.iframe) return document;
      const frame = safeQuery(b.iframe);
      return frame?.contentDocument || null;
    }

    function queryInDoc(selector, doc) {
      if (!doc) return null;
      return shadowQuery(selector, doc);
    }

    function collectShadowRoots() {
      for (const b of active) {
        const parts = b.selector.split(" >>> ");
        if (parts.length <= 1) continue;
        const doc = getDocForBinding(b);
        if (!doc) continue;
        let root = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          const host = root.querySelector(parts[i]);
          if (!host?.shadowRoot) break;
          observeRoot(host.shadowRoot);
          root = host.shadowRoot;
        }
      }
    }

    function checkAll() {
      collectShadowRoots();
      for (const b of active) {
        const wasPresent = autoPresence.get(b.selector) ?? false;
        const el = queryInDoc(b.selector, getDocForBinding(b));
        if (!el) {
          autoPresence.set(b.selector, false);
        } else if (!wasPresent && isVisible(el)) {
          activateElement(el);
          autoPresence.set(b.selector, true);
        }
      }
    }

    autoObserver = new MutationObserver(checkAll);
    observeRoot(document.body);
    checkAll();
  }

  function applyBindings(allBindings) {
    const split = splitBindings(allBindings);
    effectiveDefaults = split.defaults;
    pageBindings = split.userBindings;
    renderBar(bar, effectiveDefaults, pageBindings);
    syncAutoObserver();
  }

  let sequenceObserver = null;
  let sequenceTimeout = null;

  function cancelSequenceWatcher() {
    if (sequenceObserver) {
      sequenceObserver.disconnect();
      sequenceObserver = null;
    }
    clearTimeout(sequenceTimeout);
    sequenceTimeout = null;
  }

  async function fireSequenceQueue(queue) {
    cancelSequenceWatcher();
    if (!queue || queue.length === 0) return;

    const [step, ...remaining] = queue;
    const page = getPagePath();

    async function advance(el) {
      if (remaining.length === 0) {
        await clearSequenceQueue(page);
      } else {
        await setSequenceQueue(remaining[0].page, remaining);
      }
      activateElement(el);
    }

    const el = safeQuery(step.selector);
    if (el && isVisible(el)) {
      await advance(el);
      return;
    }

    sequenceObserver = new MutationObserver(async () => {
      const found = safeQuery(step.selector);
      if (!found || !isVisible(found)) return;
      cancelSequenceWatcher();
      await advance(found);
    });
    sequenceObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    sequenceTimeout = setTimeout(() => {
      cancelSequenceWatcher();
      clearSequenceQueue(page);
    }, 10000);
  }

  async function loadInitialState() {
    const page = getPagePath();
    const [allBindings, hidden, theme, layout, queue, draft] = await Promise.all([
      getBindings(page),
      getBarHidden(),
      getTheme(),
      getLayout(),
      getSequenceQueue(page),
      getSequenceDraft(),
    ]);
    applyBindings(allBindings);
    setBarHidden(bar, hidden);
    applyTheme(theme);
    applyLayout(bar, layout);
    if (draft) {
      bindingMode = true;
      notifyIframesBindingMode(true);
      setBarActive(bar, true);
      startSequenceBindFlow(draft.steps);
    } else {
      fireSequenceQueue(queue);
    }
  }

  loadInitialState();

  onBarHiddenChange((hidden) => setBarHidden(bar, hidden));
  onBindingsChange(applyBindings);
  onThemeChange((theme) => applyTheme(theme));
  onLayoutChange((layout) => applyLayout(bar, layout));
  onSequenceQueueChange(fireSequenceQueue);

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
      if (awaitingClick?.onSequenceStep) clearSequenceDraft();
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

    if (result.bindingType === "sequence") {
      startSequenceBindFlow();
    } else if (result.needsElement) {
      awaitingClick = { bindingType: result.bindingType };
      showDirections(directions, "Click an element · Esc to cancel");
    } else {
      await addBinding(result.scope, result);
      if (bindingMode) toggleBindingMode();
    }
  }

  function startSequenceBindFlow(initialSteps = []) {
    const steps = [...initialSteps];

    function promptNext() {
      const n = steps.length + 1;
      const canFinish = steps.length >= 2;
      showDirections(
        directions,
        canFinish
          ? `Click step ${n} · Enter to finish · Esc to cancel`
          : `Click step ${n} · Esc to cancel`,
      );
      awaitingClick = {
        onSequenceStep: onStep,
        onSequenceFinish: canFinish ? finishCapture : null,
      };
    }

    async function onStep(targetEl) {
      const isDescriptor = !(targetEl instanceof Element);
      const step = {
        selector: isDescriptor ? targetEl.selector : getSelector(targetEl),
        page: getPagePath(),
      };
      if (isDescriptor && targetEl.iframeSelector) step.iframe = targetEl.iframeSelector;
      steps.push(step);
      awaitingClick = null;
      await setSequenceDraft(steps);
      promptNext();
    }

    async function finishCapture() {
      awaitingClick = null;
      hideDirections(directions);
      await clearSequenceDraft();
      const result = await openSequenceFinishModal(steps, getPagePath());
      clearSelection();
      if (result) await addBinding(result.scope, result);
      if (bindingMode) toggleBindingMode();
    }

    promptNext();
  }

  async function completeElementPick(targetEl) {
    const { bindingType } = awaitingClick;
    awaitingClick = null;

    const result = await openElementModal(
      targetEl,
      bindingType,
      getPagePath(),
      {
        onNeedsAlt(onAltElement) {
          awaitingClick = { onAltElement };
          notifyIframesBindingMode(true);
          showDirections(directions, "Click the alternate element");
        },
      },
    );
    clearSelection();
    if (result) await addBinding(result.scope, result);
    if (bindingMode) toggleBindingMode();
  }

  async function handleClick(e) {
    if (!bindingMode || !awaitingClick) return;

    const target = findInteractiveAncestor(e.composedPath()[0] ?? e.target);
    if (!target) return;

    clearSelection();
    selectedElement = target;
    target.classList.add("bindy-selected");

    if (awaitingClick.onSequenceStep) {
      // Don't preventDefault — let the click proceed naturally so <a> tags navigate
      await awaitingClick.onSequenceStep(target);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    if (awaitingClick.onAltElement) {
      const { onAltElement } = awaitingClick;
      awaitingClick = null;
      showDirections(directions, "Alternate element captured");
      onAltElement(target);
      return;
    }

    await completeElementPick(target);
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

    if (awaitingClick.onSequenceStep) {
      await awaitingClick.onSequenceStep({ selector, iframeSelector });
      return;
    }

    await completeElementPick({ selector, iframeSelector });
  }

  async function editBindings() {
    await openEditModal(pageBindings, effectiveDefaults, DEFAULT_BINDINGS);
  }

  function focusBar() {
    if (document.activeElement === bar) {
      bar.blur();
      restorePreviousFocus();
    } else {
      previousFocus = document.activeElement;
      bar.focus({ preventScroll: true });
    }
  }

  function restorePreviousFocus() {
    const el = previousFocus;
    previousFocus = null;
    if (el && document.body.contains(el)) {
      el.focus({ preventScroll: true });
    }
  }

  function doToggleBarHidden() {
    const wasBarFocused = document.activeElement === bar;
    const temporarilyShown =
      wasBarFocused && bar.classList.contains("bindy-bar--hidden");
    bar.blur();
    if (wasBarFocused) restorePreviousFocus();
    if (!temporarilyShown) toggleBarHidden();
  }

  const ctx = {
    toggleBindingMode,
    editBindings,
    focusBar,
    toggleBarHidden: doToggleBarHidden,
  };

  function handleKeys(e) {
    if (activeModal) return;

    if (bindingMode && awaitingClick && isPlainEscape(e)) {
      e.preventDefault();
      e.stopPropagation();
      toggleBindingMode();
      return;
    }

    if (bindingMode && awaitingClick?.onSequenceFinish && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      awaitingClick.onSequenceFinish();
      return;
    }

    if (isTypingTarget(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey)
      return;

    const barFocused = document.activeElement === bar;

    if (barFocused && isPlainEscape(e)) {
      e.preventDefault();
      e.stopPropagation();
      bar.blur();
      restorePreviousFocus();
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
  bar.addEventListener("mousedown", () => {
    if (document.activeElement !== bar) {
      previousFocus = document.activeElement;
    }
  });
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
