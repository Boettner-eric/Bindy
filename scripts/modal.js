let activeModal = null;
let activeCancel = null;
let preFocusEl = null;

const BINDING_TYPES = [
  { type: "click", label: "Click element", needsElement: true },
  { type: "emulate", label: "Emulate key", needsElement: false },
  { type: "hint", label: "Hint (display only)", needsElement: false },
  { type: "action", label: "Built-in action", needsElement: false },
];

const BUILTIN_ACTIONS = [
  { type: "toggleBindingMode", label: "bind" },
  { type: "scroll", dy: 300, label: "scroll down" },
  { type: "scroll", dy: -300, label: "scroll up" },
  { type: "scroll", to: "bottom", label: "scroll to bottom" },
  { type: "scroll", to: "top", label: "scroll to top" },
  { type: "toggleBarHidden", label: "hide bar" },
  { type: "blur", label: "blur" },
  { type: "changeTheme", label: "change theme" },
  { type: "changeLayout", label: "change layout" },
  { type: "openSettings", label: "settings" },
];

const SCOPE_OPTIONS = [
  { label: "This page", value: "page" },
  { label: "This site", value: "site" },
  { label: "All pages", value: "all" },
  { label: "Custom path", value: "custom" },
];

const MODE_OPTIONS = [
  { label: "Pinned (always visible, always active)", value: "pinned" },
  { label: "Background (hidden, always active)", value: "background" },
  { label: "Focused (visible + active only on focus)", value: "focused" },
];

function makeHint(text) {
  const hint = document.createElement("div");
  hint.className = "bindy-modal__hint";
  hint.textContent = text;
  return hint;
}

function closeHotkeyModal() {
  if (activeCancel) activeCancel();
}

function openTypePickerModal() {
  if (activeCancel) activeCancel();

  return new Promise((resolve) => {
    const modal = createModal();
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      teardownModal(modal);
      resolve(value);
    }

    function cancel() {
      finish(null);
    }

    activeCancel = cancel;

    const title = document.createElement("div");
    title.className = "bindy-modal__title";
    title.textContent = "New binding";
    modal.appendChild(title);

    function onTypeSelect(i) {
      const picked = BINDING_TYPES[i];
      if (picked.needsElement) {
        finish({ needsElement: true, bindingType: picked.type });
      } else {
        startNonElementFlow(modal, title, picked.type, finish);
      }
    }

    showListPicker(
      modal,
      BINDING_TYPES.map((t) => t.label),
      onTypeSelect,
      cancel,
    );

    modal.appendChild(
      makeHint("j/k to move · Enter to select · Esc to cancel"),
    );
    document.body.appendChild(modal);
  });
}

// pageUrl is passed so we can build scope options
// targetEl may be a live DOM Element or a descriptor { selector, iframeSelector }
// onNeedsAlt(onAltElement) is called when the user chooses to add an alternate element;
// the caller sets up awaitingClick and later calls onAltElement(el) to continue the flow
function openElementModal(targetEl, bindingType, pageUrl, { onNeedsAlt } = {}) {
  if (activeCancel) activeCancel();

  const isDescriptor = !(targetEl instanceof Element);

  return new Promise((resolve) => {
    const modal = createModal();
    let settled = false;
    const state = {
      selector: isDescriptor ? targetEl.selector : getSelector(targetEl),
    };
    if (isDescriptor) state.iframe = targetEl.iframeSelector;

    function finish(value) {
      if (settled) return;
      settled = true;
      teardownModal(modal);
      resolve(value);
    }

    function cancel() {
      finish(null);
    }

    activeCancel = cancel;

    function onMode(mode) {
      const binding = {
        name: state.name,
        selector: state.selector,
        hotkey: state.hotkey,
        type: bindingType,
        scope: state.scope,
        mode: mode,
      };
      if (state.iframe) binding.iframe = state.iframe;
      if (state.selectorAlt) binding.selectorAlt = state.selectorAlt;
      if (state.selectorAltIframe)
        binding.selectorAltIframe = state.selectorAltIframe;
      finish(binding);
    }

    function onScope(scope) {
      state.scope = scope;
      showModeStep(modal, onMode, cancel);
    }

    function onHotkey(hotkey) {
      state.hotkey = hotkey;
      showScopeStep(modal, pageUrl, onScope, cancel);
    }

    function onName(name) {
      state.name = name;
      showHotkeyStep(modal, `Hotkey for "${name}"`, onHotkey, cancel);
    }

    function onAltPick(i) {
      if (i === 1) {
        showNameStep(modal, onName, cancel);
        return;
      }
      // Click the element to toggle its state
      if (isDescriptor) {
        dispatchToIframe(targetEl.iframeSelector, targetEl.selector, null);
      } else {
        targetEl.click();
      }
      // Hide modal + overlay while user picks alternate element
      modal.remove();
      if (activeOverlay) activeOverlay.remove();
      if (onNeedsAlt) onNeedsAlt(onAltElement);
    }

    function onAltElement(altEl) {
      const isIframeAlt = !(altEl instanceof Element);
      state.selectorAlt = isIframeAlt ? altEl.selector : getSelector(altEl);
      if (isIframeAlt) state.selectorAltIframe = altEl.iframeSelector;
      // Re-show modal and overlay to continue the flow
      document.body.appendChild(activeOverlay);
      document.body.appendChild(modal);
      clearModalContent(modal);
      const title = document.createElement("div");
      title.className = "bindy-modal__title";
      modal.appendChild(title);
      showNameStep(modal, onName, cancel);
    }

    const title = document.createElement("div");
    title.className = "bindy-modal__title";
    title.textContent = "Add alternate element?";
    modal.appendChild(title);

    showListPicker(
      modal,
      ["Yes, add alternate element", "No, single element"],
      onAltPick,
      cancel,
    );

    modal.appendChild(
      makeHint(
        "For toggles like play/pause · j/k to move · Enter to select · Esc to cancel",
      ),
    );
    document.body.appendChild(modal);
  });
}

// --- Non-element flows (emulate, hint, action) ---

function startNonElementFlow(modal, title, type, finish) {
  modal.textContent = "";
  modal.appendChild(title);

  if (type === "emulate") {
    showEmulateFlow(modal, title, finish);
  } else if (type === "hint") {
    showHintFlow(modal, title, finish);
  } else if (type === "action") {
    showActionFlow(modal, title, finish);
  }
}

function showEmulateFlow(modal, title, finish) {
  title.textContent = "Emulate key";
  const state = {};

  function cancel() {
    finish(null);
  }

  function onMode(mode) {
    finish({ ...state.binding, scope: state.scope, mode: mode });
  }

  function onScope(scope) {
    state.scope = scope;
    showModeStep(modal, onMode, cancel);
  }

  function onEmulateKey(emulateKey) {
    state.binding = {
      name: state.name,
      hotkey: state.hotkey,
      type: "emulate",
      emulateKey: emulateKey,
    };
    showScopeStep(modal, currentPageUrl(), onScope, cancel);
  }

  function onHotkey(hotkey) {
    state.hotkey = hotkey;
    showEmulateKeyStep(modal, state.name, onEmulateKey, cancel);
  }

  function onName(name) {
    state.name = name;
    showHotkeyStep(modal, `Hotkey for "${name}"`, onHotkey, cancel);
  }

  showNameStep(modal, onName, cancel);
}

function showHintFlow(modal, title, finish) {
  title.textContent = "Hint";
  const state = {};

  function cancel() {
    finish(null);
  }

  function onMode(mode) {
    finish({
      name: state.name,
      hotkey: state.hotkey,
      type: "hint",
      scope: state.scope,
      mode: mode,
    });
  }

  function onScope(scope) {
    state.scope = scope;
    showModeStep(modal, onMode, cancel);
  }

  function onHotkey(hotkey) {
    state.hotkey = hotkey;
    showScopeStep(modal, currentPageUrl(), onScope, cancel);
  }

  function onName(name) {
    state.name = name;
    showHotkeyStep(modal, `Hotkey for "${name}"`, onHotkey, cancel);
  }

  showNameStep(modal, onName, cancel);
}

function showActionFlow(modal, title, finish) {
  title.textContent = "Pick an action";

  const state = {};

  function cancel() {
    finish(null);
  }

  function onMode(mode) {
    finish({ ...state.binding, scope: state.scope, mode: mode });
  }

  function onScope(scope) {
    state.scope = scope;
    showModeStep(modal, onMode, cancel);
  }

  function onActionHotkey(hotkey) {
    const action = state.action;
    state.binding = { name: action.label, hotkey: hotkey, ...action };
    delete state.binding.label;
    showScopeStep(modal, currentPageUrl(), onScope, cancel);
  }

  function pickAction(action) {
    state.action = action;
    modal.textContent = "";
    const t = document.createElement("div");
    t.className = "bindy-modal__title";
    modal.appendChild(t);

    showHotkeyStep(
      modal,
      `Hotkey for "${action.label}"`,
      onActionHotkey,
      cancel,
    );
  }

  showListPicker(
    modal,
    BUILTIN_ACTIONS.map((t) => t.label),
    (i) => pickAction(BUILTIN_ACTIONS[i]),
    cancel,
  );

  modal.appendChild(makeHint("j/k to move · Enter to select · Esc to cancel"));
}

// --- Edit/Remove flow ---

const EDIT_ACTIONS = [
  { label: "Edit name", value: "editName" },
  { label: "Edit hotkey", value: "editHotkey" },
  { label: "Edit type", value: "editType" },
  { label: "Edit scope", value: "editScope" },
  { label: "Edit mode", value: "editMode" },
  { label: "Delete", value: "delete" },
];

function openEditModal(pageBindings, defaults, originalDefaults) {
  if (activeCancel) activeCancel();

  defaults = defaults || [];
  originalDefaults = originalDefaults || [];

  return new Promise((resolve) => {
    const modal = createModal();
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      teardownModal(modal);
      resolve(value);
    }

    function cancel() {
      finish(null);
    }

    activeCancel = cancel;

    const allItems = [
      ...defaults.map((b) => ({ binding: b, isDefault: true })),
      ...pageBindings.map((b) => ({ binding: b, isDefault: false })),
    ];

    if (allItems.length === 0) {
      const title = document.createElement("div");
      title.className = "bindy-modal__title";
      title.textContent = "No bindings on this page";
      modal.appendChild(title);
      modal.appendChild(makeHint("Esc to close"));

      function handleEscapeKey(ev) {
        if (isPlainEscape(ev)) {
          ev.preventDefault();
          ev.stopPropagation();
          document.removeEventListener("keydown", handleEscapeKey, true);
          finish(null);
        }
      }
      activeCancel = () => {
        document.removeEventListener("keydown", handleEscapeKey, true);
        finish(null);
      };
      document.addEventListener("keydown", handleEscapeKey, true);

      document.body.appendChild(modal);
      return;
    }

    const title = document.createElement("div");
    title.className = "bindy-modal__title";
    title.textContent = "Edit binding";
    modal.appendChild(title);

    const labels = allItems.map((item) => {
      const b = item.binding;
      const suffix = item.isDefault ? " (default)" : "";
      return `[${b.hotkey}] ${b.name}${suffix}`;
    });

    function onSelect(i) {
      const item = allItems[i];
      if (item.isDefault) {
        showDefaultEditActions(
          modal,
          title,
          item.binding,
          originalDefaults,
          finish,
        );
      } else {
        showEditActions(modal, title, item.binding, finish);
      }
    }

    showListPicker(modal, labels, onSelect, cancel);

    modal.appendChild(
      makeHint("j/k to move · Enter to select · Esc to cancel"),
    );
    document.body.appendChild(modal);
  });
}

function showEditActions(modal, title, binding, finish) {
  clearModalContent(modal);
  title = modal.querySelector(".bindy-modal__title");
  if (title) title.textContent = `[${binding.hotkey}] ${binding.name}`;

  const oldScope = binding.scope;
  const oldHotkey = binding.hotkey;

  function cancel() {
    finish(null);
  }

  function handleDelete() {
    removeBinding(oldScope, oldHotkey);
    finish({ action: "deleted" });
  }

  function handleEditName() {
    clearModalContent(modal);

    function onNewName(name) {
      const updated = { ...binding, name: name };
      delete updated.scope;
      updateBinding(oldScope, oldHotkey, oldScope, updated);
      finish({ action: "updated" });
    }

    showNameStep(modal, onNewName, cancel);
  }

  function handleEditHotkey() {
    clearModalContent(modal);

    function onNewHotkey(hotkey) {
      const updated = { ...binding, hotkey: hotkey };
      delete updated.scope;
      updateBinding(oldScope, oldHotkey, oldScope, updated);
      finish({ action: "updated" });
    }

    showHotkeyStep(
      modal,
      `New hotkey for "${binding.name}"`,
      onNewHotkey,
      cancel,
    );
  }

  function handleEditType() {
    clearModalContent(modal);
    const t = modal.querySelector(".bindy-modal__title");
    if (t) t.textContent = "Change type";

    function onTypeSelect(ti) {
      const picked = BINDING_TYPES[ti];
      const updated = { ...binding, type: picked.type };
      delete updated.scope;
      // Clear fields that don't apply to the new type
      if (picked.type !== "emulate") delete updated.emulateKey;
      if (picked.type !== "click") delete updated.selector;
      if (picked.type !== "scroll") {
        delete updated.dy;
        delete updated.to;
      }

      if (picked.type === "emulate" && !updated.emulateKey) {
        function onEmulateKey(emulateKey) {
          updated.emulateKey = emulateKey;
          updateBinding(oldScope, oldHotkey, oldScope, updated);
          finish({ action: "updated" });
        }
        showEmulateKeyStep(modal, binding.name, onEmulateKey, cancel);
        return;
      }

      updateBinding(oldScope, oldHotkey, oldScope, updated);
      finish({ action: "updated" });
    }

    showListPicker(
      modal,
      BINDING_TYPES.map((t) => t.label),
      onTypeSelect,
      cancel,
    );
    modal.appendChild(
      makeHint("j/k to move · Enter to select · Esc to cancel"),
    );
  }

  function handleEditScope() {
    function onNewScope(newScope) {
      const updated = { ...binding };
      delete updated.scope;
      updateBinding(oldScope, oldHotkey, newScope, updated);
      finish({ action: "updated" });
    }

    showScopeStep(modal, currentPageUrl(), onNewScope, cancel);
  }

  function handleEditMode() {
    function onNewMode(mode) {
      const updated = { ...binding, mode: mode };
      delete updated.scope;
      updateBinding(oldScope, oldHotkey, oldScope, updated);
      finish({ action: "updated" });
    }

    showModeStep(modal, onNewMode, cancel);
  }

  const handlers = {
    delete: handleDelete,
    editName: handleEditName,
    editHotkey: handleEditHotkey,
    editType: handleEditType,
    editScope: handleEditScope,
    editMode: handleEditMode,
  };

  showListPicker(
    modal,
    EDIT_ACTIONS.map((t) => t.label),
    (i) => handlers[EDIT_ACTIONS[i].value]?.(),
    cancel,
  );

  modal.appendChild(makeHint("j/k to move · Enter to select · Esc to cancel"));
}

function showDefaultEditActions(
  modal,
  title,
  binding,
  originalDefaults,
  finish,
) {
  clearModalContent(modal);
  title = modal.querySelector(".bindy-modal__title");
  if (title)
    title.textContent = `[${binding.hotkey}] ${binding.name} (default)`;

  const original = originalDefaults.find((b) => b.type === binding.type);
  const isOverridden =
    original &&
    (original.hotkey !== binding.hotkey || binding.mode !== original.mode);

  const actions = [
    { label: "Edit hotkey", value: "editHotkey" },
    { label: "Edit mode", value: "editMode" },
  ];
  if (isOverridden) {
    actions.push({ label: `Reset to [${original.hotkey}]`, value: "reset" });
  }

  function cancel() {
    finish(null);
  }

  function handleEditHotkey() {
    clearModalContent(modal);

    function onNewHotkey(hotkey) {
      saveDefaultOverride(binding.type, { hotkey });
      finish({ action: "updated" });
    }

    showHotkeyStep(
      modal,
      `New hotkey for "${binding.name}"`,
      onNewHotkey,
      cancel,
    );
  }

  function handleEditMode() {
    function onNewMode(mode) {
      saveDefaultOverride(binding.type, { mode });
      finish({ action: "updated" });
    }

    showModeStep(modal, onNewMode, cancel);
  }

  function handleReset() {
    resetDefaultOverride(binding.type);
    finish({ action: "reset" });
  }

  const handlers = {
    editHotkey: handleEditHotkey,
    editMode: handleEditMode,
    reset: handleReset,
  };

  showListPicker(
    modal,
    actions.map((a) => a.label),
    (i) => handlers[actions[i].value]?.(),
    cancel,
  );

  modal.appendChild(makeHint("j/k to move · Enter to select · Esc to cancel"));
}

// --- Scope & Mode steps ---

function currentPageUrl() {
  return `${window.location.host}${window.location.pathname}`;
}

function showScopeStep(modal, pageUrl, onScope, onCancel) {
  clearModalContent(modal);
  const title = modal.querySelector(".bindy-modal__title");
  if (title) title.textContent = "Where should this work?";

  const siteScope = window.location.host + "/";

  function onScopeSelect(i) {
    const picked = SCOPE_OPTIONS[i].value;
    if (picked === "page") {
      onScope(pageUrl);
    } else if (picked === "site") {
      onScope(siteScope);
    } else if (picked === "all") {
      onScope("/");
    } else if (picked === "custom") {
      showCustomScopeInput(modal, onScope, onCancel);
    }
  }

  showListPicker(
    modal,
    SCOPE_OPTIONS.map((t) => t.label),
    onScopeSelect,
    () => onCancel(null),
  );

  modal.appendChild(makeHint("j/k to move · Enter to select · Esc to cancel"));
}

function showCustomScopeInput(modal, onScope, onCancel) {
  clearModalContent(modal);
  const title = modal.querySelector(".bindy-modal__title");
  if (title) title.textContent = "Enter path prefix";

  const input = document.createElement("input");
  input.className = "bindy-modal__input";
  input.type = "text";
  input.placeholder = "e.g. youtube.com/watch";

  const hint = makeHint("Enter to confirm · Esc to cancel");

  modal.appendChild(input);
  modal.appendChild(hint);
  requestAnimationFrame(() => input.focus());

  function handleKeydown(ev) {
    if (isPlainEscape(ev)) {
      ev.preventDefault();
      onCancel(null);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      const scope = input.value.trim();
      if (!scope) return;
      input.remove();
      hint.remove();
      onScope(scope);
    }
  }

  input.addEventListener("keydown", handleKeydown);
}

function showModeStep(modal, onMode, onCancel) {
  clearModalContent(modal);
  const title = modal.querySelector(".bindy-modal__title");
  if (title) title.textContent = "Mode";

  showListPicker(
    modal,
    MODE_OPTIONS.map((t) => t.label),
    (i) => onMode(MODE_OPTIONS[i].value),
    () => onCancel(null),
  );

  modal.appendChild(makeHint("j/k to move · Enter to select · Esc to cancel"));
}

function openListModal(titleText, labels, onSelect) {
  if (activeCancel) activeCancel();

  return new Promise((resolve) => {
    const modal = createModal();

    function finish(value) {
      teardownModal(modal);
      resolve(value);
    }

    activeCancel = () => finish(null);

    const title = document.createElement("div");
    title.className = "bindy-modal__title";
    title.textContent = titleText;
    modal.appendChild(title);

    showListPicker(
      modal,
      labels,
      (i) => {
        const result = onSelect(i);
        finish(result);
      },
      () => finish(null),
    );

    modal.appendChild(
      makeHint("j/k to move · Enter to select · Esc to cancel"),
    );
    document.body.appendChild(modal);
  });
}

// --- Shared step helpers ---

let activeOverlay = null;

function createModal() {
  const overlay = document.createElement("div");
  overlay.className = "bindy-overlay";
  overlay.tabIndex = -1;
  overlay.addEventListener("click", () => {
    if (activeCancel) activeCancel();
  });
  document.body.appendChild(overlay);
  preFocusEl = document.activeElement;
  overlay.focus({ preventScroll: true });
  activeOverlay = overlay;

  const modal = document.createElement("div");
  modal.className = "bindy-modal";
  activeModal = modal;
  return modal;
}

function teardownModal(modal) {
  if (activeModal === modal) {
    modal.remove();
    activeModal = null;
    activeCancel = null;
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    const el = preFocusEl;
    preFocusEl = null;
    if (el && document.body.contains(el)) {
      el.focus({ preventScroll: true });
    }
  }
}

function clearModalContent(modal) {
  const title = modal.querySelector(".bindy-modal__title");
  modal.textContent = "";
  if (title) modal.appendChild(title);
}

function showListPicker(modal, labels, onSelect, onCancel) {
  const list = document.createElement("div");
  list.className = "bindy-modal__list";

  let activeIndex = 0;

  function createItem(label, i) {
    const item = document.createElement("div");
    item.className = "bindy-modal__list-item";
    item.textContent = label;
    item.addEventListener("click", () => {
      cleanup();
      onSelect(i);
    });
    list.appendChild(item);
    return item;
  }

  const items = labels.map(createItem);

  function highlight(index) {
    items[activeIndex].classList.remove("bindy-modal__list-item--active");
    activeIndex = index;
    items[activeIndex].classList.add("bindy-modal__list-item--active");
  }

  highlight(0);
  modal.appendChild(list);

  function handleKeydown(ev) {
    ev.stopPropagation();
    const key = ev.key;

    if (isPlainEscape(ev)) {
      ev.preventDefault();
      cleanup();
      onCancel();
      return;
    }
    if (key === "ArrowDown" || key === "j") {
      ev.preventDefault();
      highlight((activeIndex + 1) % items.length);
      return;
    }
    if (key === "ArrowUp" || key === "k") {
      ev.preventDefault();
      highlight((activeIndex - 1 + items.length) % items.length);
      return;
    }
    if (key === "Enter") {
      ev.preventDefault();
      cleanup();
      onSelect(activeIndex);
    }
  }

  function cleanup() {
    document.removeEventListener("keydown", handleKeydown, true);
    list.remove();
  }

  activeCancel = () => {
    cleanup();
    onCancel();
  };
  document.addEventListener("keydown", handleKeydown, true);
}

function showNameStep(modal, onName, onCancel) {
  function ensureTitle() {
    const existing = modal.querySelector(".bindy-modal__title");
    if (existing) return existing;
    const t = document.createElement("div");
    t.className = "bindy-modal__title";
    modal.appendChild(t);
    return t;
  }

  const title = ensureTitle();
  title.textContent = "Name this binding";

  const nameInput = document.createElement("input");
  nameInput.className = "bindy-modal__input";
  nameInput.type = "text";
  nameInput.placeholder = "e.g. Open menu";

  const hint = makeHint("Enter to continue · Esc to cancel");

  modal.appendChild(nameInput);
  modal.appendChild(hint);
  requestAnimationFrame(function focusInput() {
    nameInput.focus();
  });

  function handleKeydown(ev) {
    if (isPlainEscape(ev)) {
      ev.preventDefault();
      onCancel(null);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      nameInput.remove();
      hint.remove();
      onName(name);
    }
  }

  nameInput.addEventListener("keydown", handleKeydown);
}

function showKeyCaptureStep(modal, titleText, hintText, onKey, onCancel) {
  const title = modal.querySelector(".bindy-modal__title");
  if (title) title.textContent = titleText;

  const hint = makeHint(hintText);
  modal.appendChild(hint);

  function cleanup() {
    document.removeEventListener("keydown", handleKeydown, true);
    hint.remove();
  }

  function handleKeydown(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (isPlainEscape(ev)) {
      cleanup();
      onCancel(null);
      return;
    }
    if (isModifierKey(ev.key)) return;
    cleanup();
    onKey(formatHotkey(ev));
  }

  activeCancel = () => {
    cleanup();
    onCancel(null);
  };
  document.addEventListener("keydown", handleKeydown, true);
}

function showHotkeyStep(modal, label, onHotkey, onCancel) {
  showKeyCaptureStep(
    modal,
    label,
    "Press a key · Esc to cancel",
    onHotkey,
    onCancel,
  );
}

function showEmulateKeyStep(modal, name, onKey, onCancel) {
  showKeyCaptureStep(
    modal,
    `Key to emulate for "${name}"`,
    "Press the key to emulate · Esc to cancel",
    onKey,
    onCancel,
  );
}
