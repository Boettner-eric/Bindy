function getBindings(pageUrl) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      resolve(matchBindings(bindings, pageUrl));
    });
  });
}

function addBinding(scope, binding) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      const list = bindings[scope] || [];
      list.push(binding);
      bindings[scope] = list;
      chrome.storage.local.set({ bindings }, resolve);
    });
  });
}

function onBindingsChange(pageUrl, cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.bindings) return;
    cb(matchBindings(changes.bindings.newValue || {}, pageUrl));
  });
}

function matchBindings(bindings, pageUrl) {
  const matched = [];
  for (const scope in bindings) {
    if (scope === "/" || pageUrl.startsWith(scope)) {
      for (const b of bindings[scope]) {
        matched.push({ ...b, scope });
      }
    }
  }
  return matched;
}

function removeBinding(scope, hotkey) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      const list = bindings[scope] || [];
      bindings[scope] = list.filter((b) => b.hotkey !== hotkey);
      if (bindings[scope].length === 0) delete bindings[scope];
      chrome.storage.local.set({ bindings }, resolve);
    });
  });
}

function updateBinding(oldScope, oldHotkey, newScope, newBinding) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      // Remove old
      const oldList = bindings[oldScope] || [];
      bindings[oldScope] = oldList.filter((b) => b.hotkey !== oldHotkey);
      if (bindings[oldScope].length === 0) delete bindings[oldScope];
      // Add new
      const newList = bindings[newScope] || [];
      newList.push(newBinding);
      bindings[newScope] = newList;
      chrome.storage.local.set({ bindings }, resolve);
    });
  });
}

function getBarHidden() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ barHidden: false }, ({ barHidden }) => {
      resolve(barHidden);
    });
  });
}

function toggleBarHidden() {
  chrome.storage.local.get({ barHidden: false }, ({ barHidden }) => {
    chrome.storage.local.set({ barHidden: !barHidden });
  });
}

function onBarHiddenChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.barHidden) return;
    cb(changes.barHidden.newValue);
  });
}

function saveDefaultOverride(type, overrides) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      const list = bindings["/"] || [];
      const existing = list.find((b) => b.builtin && b.type === type);
      if (existing) {
        Object.assign(existing, overrides);
      } else {
        list.push({ type, builtin: true, ...overrides });
      }
      bindings["/"] = list;
      chrome.storage.local.set({ bindings }, resolve);
    });
  });
}

function resetDefaultOverride(type) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ bindings: {} }, ({ bindings }) => {
      const list = bindings["/"] || [];
      bindings["/"] = list.filter((b) => !(b.builtin && b.type === type));
      if (bindings["/"].length === 0) delete bindings["/"];
      chrome.storage.local.set({ bindings }, resolve);
    });
  });
}
