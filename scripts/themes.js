const THEMES = [
  {
    name: "Skeletor",
    bg: "#2b2836",
    bgDeep: "#1e1c26",
    text: "#dce7fd",
    muted: "#655e7f",
    accent: "#bd93f9",
    accentGlow: "rgba(189, 147, 249, 0.4)",
    highlight: "#3b3750",
  },
  {
    name: "Dracula",
    bg: "#282a36",
    bgDeep: "#1e1f29",
    text: "#f8f8f2",
    muted: "#6272a4",
    accent: "#50fa7b",
    accentGlow: "rgba(80, 250, 123, 0.4)",
    highlight: "#44475a",
  },
  {
    name: "Nord",
    bg: "#2e3440",
    bgDeep: "#242933",
    text: "#eceff4",
    muted: "#4c566a",
    accent: "#88c0d0",
    accentGlow: "rgba(136, 192, 208, 0.4)",
    highlight: "#3b4252",
  },
  {
    name: "Monokai",
    bg: "#272822",
    bgDeep: "#1e1f1c",
    text: "#f8f8f2",
    muted: "#75715e",
    accent: "#f92672",
    accentGlow: "rgba(249, 38, 114, 0.4)",
    highlight: "#3e3d32",
  },
  {
    name: "Solarized",
    bg: "#002b36",
    bgDeep: "#001f27",
    text: "#93a1a1",
    muted: "#586e75",
    accent: "#b58900",
    accentGlow: "rgba(181, 137, 0, 0.4)",
    highlight: "#073642",
  },
  {
    name: "Rosé Pine",
    bg: "#191724",
    bgDeep: "#13111e",
    text: "#e0def4",
    muted: "#6e6a86",
    accent: "#ebbcba",
    accentGlow: "rgba(235, 188, 186, 0.4)",
    highlight: "#26233a",
  },
];

const LAYOUTS = ["bar", "sidebar"];

function applyTheme(theme, root) {
  const el = root || document.documentElement;
  if (theme.name === "Arc") {
    el.classList.add("bindy-theme-arc");
    // Clear any inline overrides from previous static themes
    for (const prop of ["--bindy-bg", "--bindy-bg-deep", "--bindy-text", "--bindy-muted", "--bindy-accent", "--bindy-accent-glow", "--bindy-highlight"]) {
      el.style.removeProperty(prop);
    }
  } else {
    el.classList.remove("bindy-theme-arc");
    el.style.setProperty("--bindy-bg", theme.bg);
    el.style.setProperty("--bindy-bg-deep", theme.bgDeep);
    el.style.setProperty("--bindy-text", theme.text);
    el.style.setProperty("--bindy-muted", theme.muted);
    el.style.setProperty("--bindy-accent", theme.accent);
    el.style.setProperty("--bindy-accent-glow", theme.accentGlow);
    el.style.setProperty("--bindy-highlight", theme.highlight);
  }
}

function applyLayout(bar, layout) {
  bar.classList.toggle("bindy-bar--sidebar", layout === "sidebar");
}

function resolveTheme(name) {
  if (name === "Arc") return { name: "Arc" };
  return THEMES.find((t) => t.name === name) || THEMES[0];
}

function getTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ theme: "Skeletor" }, ({ theme }) => {
      resolve(resolveTheme(theme));
    });
  });
}

function setTheme(name) {
  chrome.storage.local.set({ theme: name });
}

function getLayout() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ layout: "bar" }, ({ layout }) => {
      resolve(layout);
    });
  });
}

function setLayout(layout) {
  chrome.storage.local.set({ layout });
}

function onThemeChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.theme) return;
    cb(resolveTheme(changes.theme.newValue));
  });
}

function onLayoutChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.layout) return;
    cb(changes.layout.newValue);
  });
}
