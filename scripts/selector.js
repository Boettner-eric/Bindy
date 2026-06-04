const STABLE_ATTRS = [
  "data-testid",
  "data-test",
  "name",
  "data-title-no-tooltip",
  "aria-label",
];

const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "SUMMARY",
  "LABEL",
]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "menuitem",
  "tab",
  "switch",
  "radio",
  "option",
]);

function uniqueAttrSelector(el, root = document) {
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    const sel = `[${attr}="${CSS.escape(val)}"]`;
    if (root.querySelectorAll(sel).length === 1) return sel;
  }
  return null;
}

function localSelector(el, root = document) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrSel = uniqueAttrSelector(el, root);
  if (attrSel) return attrSel;
  let part = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const sameTag = [...parent.children].filter(
      (c) => c.tagName === el.tagName,
    );
    if (sameTag.length > 1) {
      part += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
    }
  }
  return part;
}

// Build a selector for el within a ShadowRoot boundary.
function getSelectorInRoot(el, root) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrSel = uniqueAttrSelector(el, root);
  if (attrSel) return attrSel;

  const parts = [];
  let node = el;
  while (node && node.nodeType === 1) {
    parts.unshift(localSelector(node, root));
    const candidate = parts.join(" > ");
    if (root.querySelectorAll(candidate).length === 1) return candidate;
    const parent = node.parentElement;
    if (!parent || parent.getRootNode() !== root) break;
    node = parent;
  }
  return parts.join(" > ");
}

function getSelector(el) {
  // Shadow DOM: encode as "host-selector >>> inner-selector" (may be nested).
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) {
    const hostSelector = getSelector(root.host);
    const innerSelector = getSelectorInRoot(el, root);
    return `${hostSelector} >>> ${innerSelector}`;
  }

  if (el.id && document.querySelector(`#${CSS.escape(el.id)}`) === el)
    return `#${CSS.escape(el.id)}`;
  const attrSel = uniqueAttrSelector(el);
  if (attrSel) return attrSel;

  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    parts.unshift(localSelector(node));
    const candidate = parts.join(" > ");
    if (document.querySelectorAll(candidate).length === 1) return candidate;
    if (node.parentElement) {
      const parentAnchor =
        node.parentElement.id && `#${CSS.escape(node.parentElement.id)}`;
      if (
        parentAnchor &&
        document.querySelectorAll(parentAnchor).length === 1
      ) {
        return `${parentAnchor} ${candidate}`;
      }
    }
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function isInteractive(el) {
  if (!el || el.nodeType !== 1) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  const role = el.getAttribute("role");
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (el.hasAttribute("tabindex")) return true;
  if (el.isContentEditable) return true;
  return false;
}

function findInteractiveAncestor(el) {
  let node = el;
  while (node && node !== document.body) {
    if (isInteractive(node)) return node;
    if (node.parentElement) {
      node = node.parentElement;
    } else {
      // At the shadow root boundary — continue to the host element.
      const nodeRoot = node.getRootNode();
      node = nodeRoot instanceof ShadowRoot ? nodeRoot.host : null;
    }
  }
  return null;
}

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function activateElement(el) {
  if (isTypingTarget(el)) {
    el.focus();
  } else {
    const opts = { bubbles: true, cancelable: true };
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    // click() after mousedown/mouseup mirrors real browser order; most sites
    // handle click, but some (e.g. Gmail tabs) only listen on mouseup.
    el.click();
  }
}
