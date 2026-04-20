// Child frame: handle messages from the top frame
function initChildFrame() {
  let iframeSelector = null;

  function handleDispatch(selector, selectorAlt) {
    const el = safeQuery(selector);
    const alt = selectorAlt ? safeQuery(selectorAlt) : null;
    const target = (el && isVisible(el)) ? el : alt;
    if (!target) return;
    activateElement(target);
  }

  function handleBindClick(e) {
    const target = findInteractiveAncestor(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const selector = getSelector(target);
    window.parent.postMessage(
      { type: "bindy-element-picked", selector, iframeSelector },
      "*",
    );
  }

  function handleMessage(evt) {
    if (evt.source !== window.parent) return;
    const msg = evt.data;
    if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("bindy-")) return;

    if (msg.type === "bindy-bind-start") {
      iframeSelector = msg.iframeSelector;
      document.addEventListener("click", handleBindClick, true);
    } else if (msg.type === "bindy-bind-stop") {
      iframeSelector = null;
      document.removeEventListener("click", handleBindClick, true);
    } else if (msg.type === "bindy-dispatch") {
      // Temporarily remove the click listener so the programmatic click
      // doesn't re-trigger handleBindClick and send a spurious element pick.
      document.removeEventListener("click", handleBindClick, true);
      handleDispatch(msg.selector, msg.selectorAlt);
      if (iframeSelector) {
        document.addEventListener("click", handleBindClick, true);
      }
    }
  }

  window.addEventListener("message", handleMessage);

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    window.parent.postMessage({
      type: "bindy-keydown",
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    }, "*");
  }, true);
}

// Top frame: broadcast binding mode changes to all child iframes
function notifyIframesBindingMode(entering) {
  const frames = document.querySelectorAll("iframe");
  for (const frame of frames) {
    if (!frame.contentWindow) continue;
    if (entering) {
      const sel = getSelector(frame);
      frame.contentWindow.postMessage(
        { type: "bindy-bind-start", iframeSelector: sel },
        "*",
      );
    } else {
      frame.contentWindow.postMessage({ type: "bindy-bind-stop" }, "*");
    }
  }
}

// Top frame: register a callback for element picks from child iframes
function onIframeElementPicked(cb) {
  window.addEventListener("message", (evt) => {
    const msg = evt.data;
    if (!msg || msg.type !== "bindy-element-picked") return;
    cb({ selector: msg.selector, iframeSelector: msg.iframeSelector });
  });
}

// Top frame / actions.js: send a binding dispatch into a specific iframe
function dispatchToIframe(iframeSelector, selector, selectorAlt) {
  const frame = safeQuery(iframeSelector);
  if (!frame?.contentWindow) return false;
  frame.contentWindow.postMessage(
    { type: "bindy-dispatch", selector, selectorAlt: selectorAlt || null },
    "*",
  );
  return true;
}
