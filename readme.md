# Bindy

A chrome extension to allow users to define custom keyboard shortcuts on any website

![a screenshot of bindy](images/bindy.png)

## Installation

1. clone this repo or download it via `Code` -> `Download Zip` (unzip it if you download it)
2. go to `chrome://extensions` and enable Developer mode in the top right corner
3. click `load unpacked` and select the bindy folder
4. press `ctrl + f` to focus bindy and start binding new shortcuts!

## Features

- bind any clickable element to a hotkey
- emulate an existing hotkey with another one
- set a hotkey for common browser actions (scroll, theme, layout)
- site-specific hotkeys scoped to the current page path

## Keyboard Shortcuts

| Shortcut | Action                 |
| -------- | ---------------------- |
| `ctrl+f` | Focus the Bindy bar    |
| `ctrl+b` | Toggle bind mode       |
| `ctrl+e` | Edit existing bindings |
| `ctrl+h` | Show / hide the bar    |
| `ctrl+s` | Open settings          |

All default shortcuts can be rebound from the edit screen (`ctrl+e`).

## Binding Modes

![binding modes](images/mode.png)

Use **Pinned** for shortcuts you want visible at a glance. Use **Background** to keep the bar clean while still having the shortcut active. Use **Focused** for shortcuts that should only fire when you've deliberately focused the bar with `ctrl+f` — useful for avoiding conflicts with page shortcuts.

## Scopes

- This page: the exact current url (i.e. https://www.youtube.com/watch?v=abcded)
- This site: the current url path (i.e https://www.youtube.com/watch)
- All pages: every website
- Custom path: a simple pattern for a subset of paths (i.e. /watch)

## Known Issues

- Emulation doesn't always work as we can only send synthetic keyboard events and some sites will ignore them. (Youtube). An easy work around is to use click element instead
- Some iframes don't work properly
- If a site changes a dom component it might break a shortcut (you can always edit it)
