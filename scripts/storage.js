function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, resolve);
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

async function getBindings(pageUrl) {
  const { bindings } = await storageGet({ bindings: {} });
  return matchBindings(bindings, pageUrl);
}

async function addBinding(scope, binding) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings[scope] || [];
  list.push(binding);
  bindings[scope] = list;
  await storageSet({ bindings });
}

function onBindingsChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.bindings) return;
    const pageUrl = `${window.location.host}${window.location.pathname}`;
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

async function removeBinding(scope, hotkey) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings[scope] || [];
  bindings[scope] = list.filter((b) => b.hotkey !== hotkey);
  if (bindings[scope].length === 0) delete bindings[scope];
  await storageSet({ bindings });
}

async function updateBinding(oldScope, oldHotkey, newScope, newBinding) {
  const { bindings } = await storageGet({ bindings: {} });
  const oldList = bindings[oldScope] || [];
  bindings[oldScope] = oldList.filter((b) => b.hotkey !== oldHotkey);
  if (bindings[oldScope].length === 0) delete bindings[oldScope];
  const newList = bindings[newScope] || [];
  newList.push(newBinding);
  bindings[newScope] = newList;
  await storageSet({ bindings });
}

async function getBarHidden() {
  const { barHidden } = await storageGet({ barHidden: false });
  return barHidden;
}

async function toggleBarHidden() {
  const { barHidden } = await storageGet({ barHidden: false });
  chrome.storage.local.set({ barHidden: !barHidden });
}

function onBarHiddenChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.barHidden) return;
    cb(changes.barHidden.newValue);
  });
}

async function saveDefaultOverride(type, overrides) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings["/"] || [];
  const existing = list.find((b) => b.builtin && b.type === type);
  if (existing) {
    Object.assign(existing, overrides);
  } else {
    list.push({ type, builtin: true, ...overrides });
  }
  bindings["/"] = list;
  await storageSet({ bindings });
}

async function resetDefaultOverride(type) {
  const { bindings } = await storageGet({ bindings: {} });
  const list = bindings["/"] || [];
  bindings["/"] = list.filter((b) => !(b.builtin && b.type === type));
  if (bindings["/"].length === 0) delete bindings["/"];
  await storageSet({ bindings });
}
