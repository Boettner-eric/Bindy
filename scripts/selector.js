const STABLE_ATTRS = ["data-testid", "data-test", "name", "data-title-no-tooltip", "aria-label"];

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

function uniqueAttrSelector(el) {
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    const sel = `[${attr}="${CSS.escape(val)}"]`;
    if (document.querySelectorAll(sel).length === 1) return sel;
  }
  return null;
}

function localSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrSel = uniqueAttrSelector(el);
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

function getSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
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
    node = node.parentElement;
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
    el.click();
  }
}
