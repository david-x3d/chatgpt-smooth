<div align="center">

<img src="icons/icon-128.png" width="88" alt="">

# ChatGPT Smooth

**Soft, springy animations for chatgpt.com – without changing how it looks.**

[![Release](https://img.shields.io/github/v/release/david-x3d/chatgpt-smooth?label=Release&color=10a37f)](https://github.com/david-x3d/chatgpt-smooth/releases/latest)
[![Firefox](https://img.shields.io/badge/Firefox-142%2B-FF7139?logo=firefoxbrowser&logoColor=white)](#firefox--floorp--zen--librewolf)
[![Chromium](https://img.shields.io/badge/Chromium-117%2B-4285F4?logo=googlechrome&logoColor=white)](#chrome--edge--brave--vivaldi--helium)
[![License](https://img.shields.io/github/license/david-x3d/chatgpt-smooth?label=License)](LICENSE)

<img src="docs/demo.svg" width="720" alt="A message lifts off and the reply fades in line by line">

</div>

ChatGPT jumps in a lot of places: replies arrive in chunks, menus pop open, and new content appears abruptly. ChatGPT Smooth adds a layer of motion on top – with real spring physics instead of rigid transitions. Colors, fonts and layout stay exactly as they are.

## What changes

| | Without | With ChatGPT Smooth |
|---|---|---|
| **Replies** | Text arrives in chunks, the page jumps line by line | Words fade in one after another and come into focus, new lines glide up |
| **Messages** | Just appear | Your message lifts off the input box, ChatGPT's reply rises in |
| **Menus & dialogs** | Pop open | Grow out of their button, items cascade in, shrink back when closing |
| **Page changes** | Hard cut | New content glides in, whatever stays stays put |
| **Panels & layout** | Abrupt position changes | New panels glide; the sidebar keeps ChatGPT’s native motion |
| **Clicks** | – | Buttons give a little when pressed, icons morph (copy → checkmark) |
| **Pointer** | – | A soft light follows the cursor over buttons, a pulse on click |

Every effect can be switched off on its own, and the speed is adjustable. If your system has "reduce motion" turned on, chatgpt.com stays untouched.

## Installation

All files are attached to the [latest release](https://github.com/david-x3d/chatgpt-smooth/releases/latest).

### Firefox · Floorp · Zen · LibreWolf

1. Download `chatgpt-smooth-…-firefox.xpi`.
2. Open `about:addons` → gear icon → **Install Add-on From File…** and pick the file (or just drag it onto the browser window).

The file is signed by Mozilla: installed permanently, no developer mode, updates arrive automatically.

### Chrome · Edge · Brave · Vivaldi · Helium

Chromium browsers only install extensions from outside the Chrome Web Store when a browser policy allows it. On **Linux** a small script sets that up:

```bash
curl -fsSLO https://raw.githubusercontent.com/david-x3d/chatgpt-smooth/main/install/chromium-linux.sh
sudo bash chromium-linux.sh
```

Then restart the browser. The script detects Chrome, Chromium, Helium, Brave, Edge and Vivaldi. The browser downloads the signed extension from the releases by itself and keeps it up to date – no developer mode. It will say "Managed by your organization"; that only refers to this one policy.

To remove it again: `sudo bash chromium-linux.sh --uninstall`

<details>
<summary><b>Windows, macOS or without root access</b></summary>

There, Chrome and friends only allow extensions from outside the Web Store in developer mode:

1. Download `chatgpt-smooth-…-chromium.zip` and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

This way there are no automatic updates – for a new version, replace the folder and click ⟳.

</details>

## Settings

Click the toolbar icon to open the settings (the popup is in English). Changes apply instantly, no reload needed.

| Switch (in the popup) | Effect | Default |
|---|---|:---:|
| Text streaming | Words fade in, text glides while the reply scrolls along | on |
| Menus & dialogs | Menus and dialogs open and close softly | on |
| Pages & messages | Settings, chats, new messages | on |
| Sidebar & layout | Abrupt panel changes glide; native sidebar motion stays in control | on |
| Fade everything in | Every new element fades in softly | on |
| Blur | Blur-to-focus when things appear (uses a bit of GPU) | on |
| Click spring | Everything gives when pressed, icons morph | on |
| Shine & light pulse | Light follows the pointer, pulse on click | on |
| Hover transitions | Colors, arrows, switches | on |
| Smooth scrolling | Smooth programmatic scrolling (can lag behind while following a reply) | off |
| **Speed** | From fast (0.5×) to gentle (1.8×) | 1× |

## How it works

- **Real springs.** The motion comes from damped springs like SwiftUI's (`smooth`, `snappy`, `bouncy`). They are computed once and stored as CSS `linear()` curves – natural overshoot instead of rigid Bézier curves.
- **Before the first frame.** New content is picked up in a `MutationObserver` before the browser paints it. Nothing flashes in and then jumps back.
- **Streaming stays untouched.** The word-by-word fade uses the [CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API) – chatgpt.com's text is never rewritten, so copying and selecting work as always.
- **Cheap properties.** Almost everything moves via `translate`, `scale` and `opacity`; blur is only used on small areas.

## Privacy

ChatGPT Smooth sends nothing and collects nothing – no telemetry, no network requests. It runs only on `chatgpt.com` and the legacy `chat.openai.com` domain and needs a single permission: `storage`, for your settings, kept locally in the browser. Updates are fetched by the browser itself from the GitHub releases.

## Development

```
manifest.json          Firefox manifest – the folder can be loaded as is
smooth.js, smooth.css  the extension
popup.html, popup.js   settings popup
scripts/build.mjs      builds dist/firefox and dist/chromium (+ zips)
scripts/test.mjs       DOM regression tests
install/               Linux installer for Chromium browsers
```

- **Try it in Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → `manifest.json`
- **Try it in Chromium:** `node scripts/build.mjs`, then load `dist/chromium` unpacked
- **Tests:** `npm ci && npm test`
- **Lint:** `npx web-ext lint --self-hosted --source-dir dist/firefox`

The build has no dependencies – just Node ≥ 18 and `zip`.

### Publishing a new version

1. Bump the version in `manifest.json` and add an entry to `CHANGELOG.md`.
2. Tag and push: `git tag v3.2.0 && git push origin main --tags`
3. GitHub Actions builds, signs both variants and publishes the release including the update files.

Signing needs three repository secrets:

| Secret | Used for | Where to get it |
|---|---|---|
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | Firefox signature (unlisted) | [addons.mozilla.org → API keys](https://addons.mozilla.org/developers/addon/api/key/) |
| `CRX_PRIVATE_KEY` | Chromium signature, fixed extension ID | your own RSA key (PEM) |

## Disclaimer

Adapted from [Claude Smooth](https://github.com/david-x3d/claude-smooth). Unofficial community project, not affiliated with OpenAI or Anthropic. ChatGPT and Claude are trademarks of their respective owners.

## License

[MIT](LICENSE)
