function executeBinding(binding, ctx) {
  const type = binding.type || "click";
  switch (type) {
    case "click": {
      const primaryIframe = binding.iframe || null;
      const altIframe =
        binding.selectorAlt && binding.selectorAltIframe
          ? binding.selectorAltIframe
          : null;
      const crossContext = !!binding.selectorAlt && primaryIframe !== altIframe;

      if (!crossContext) {
        // Same context: let one frame handle primary + alt with fallback logic.
        if (primaryIframe) {
          return dispatchToIframe(
            primaryIframe,
            binding.selector,
            binding.selectorAlt || null,
          );
        }
        const el = safeQuery(binding.selector);
        const alt = binding.selectorAlt ? safeQuery(binding.selectorAlt) : null;
        const target = (el && isVisible(el)) ? el : (alt && isVisible(alt)) ? alt : el || alt;
        if (!target) return false;
        activateElement(target);
        return true;
      }

      // Cross-context: primary and alt live in different frames.
      // Dispatch to each independently; each fires only if its element is visible.
      if (primaryIframe) {
        dispatchToIframe(primaryIframe, binding.selector, null);
      } else {
        const el = safeQuery(binding.selector);
        if (el) activateElement(el);
      }
      if (altIframe) {
        dispatchToIframe(altIframe, binding.selectorAlt, null);
      } else {
        const alt = safeQuery(binding.selectorAlt);
        if (alt && isVisible(alt)) activateElement(alt);
      }
      return true;
    }
    case "emulate": {
      const parts = parseHotkey(binding.emulateKey);
      const event = new KeyboardEvent("keydown", {
        key: parts.key,
        code: parts.code,
        ctrlKey: parts.ctrl,
        metaKey: parts.meta,
        altKey: parts.alt,
        shiftKey: parts.shift,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return true;
    }
    case "hint":
      // display but do nothing (don't skip default)
      return false;
    case "scroll":
      if (binding.to === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (binding.to === "bottom") {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      } else {
        window.scrollBy({ top: binding.dy, behavior: "smooth" });
      }
      return true;
    case "toggleBindingMode":
      ctx.toggleBindingMode();
      return true;
    case "editBinding":
      ctx.editBindings();
      return true;
    case "focusBar":
      ctx.focusBar();
      return true;
    case "toggleBarHidden":
      ctx.toggleBarHidden();
      return true;
    case "changeTheme":
      openThemePicker();
      return true;
    case "changeLayout":
      openLayoutPicker();
      return true;
    case "openSettings":
      openSettingsPicker();
      return true;
    case "blur":
      if (document.activeElement) document.activeElement.blur();
      return true;
  }
  return false;
}

function openSettingsPicker() {
  openListModal("Settings", ["Theme", "Layout"], (i) => {
    if (i === 0) openThemePicker();
    else openLayoutPicker();
  });
}

function openThemePicker() {
  const allNames = [...THEMES.map((t) => t.name), "Arc"];
  openListModal("Choose theme", allNames, (i) => {
    setTheme(allNames[i]);
  });
}

function openLayoutPicker() {
  const labels = ["Bottom bar", "Sidebar"];
  openListModal("Choose layout", labels, (i) => {
    setLayout(LAYOUTS[i]);
  });
}

function findMatchingBinding(bindings, e) {
  if (isModifierKey(e.key)) return null;
  const pressed = formatHotkey(e);
  return bindings.find((b) => b.hotkey === pressed) || null;
}

function isVisible(el) {
  if (!el) return false;
  if (el.offsetParent === null && getComputedStyle(el).position !== "fixed")
    return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function safeQuery(selector) {
  try {
    return document.querySelector(selector);
  } catch (_) {
    return null;
  }
}

// Parse a hotkey string like "ctrl+shift+k" back into component parts
function parseHotkey(hotkeyStr) {
  const parts = hotkeyStr.split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };
}
