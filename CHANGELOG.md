# Changelog

ChatGPT port changes, followed by the original Claude Smooth history.

## [3.1.6] – 2026-11-08

- Publish the first signed Firefox release with automatic updates.
- Make animation regression tests independent of CI frame scheduling.

## [3.1.5] – 2026-11-08

- First standalone ChatGPT Smooth release, adapted from Claude Smooth.
- Add ChatGPT message streaming, menus, page motion and configurable spring effects.
- Keep native sidebar motion and avoid per-frame layout/style observation overhead.
- Add the teal wave logo and independent Firefox/Chromium update channels.

## [3.1.4] – 2026-11-08

- Add a new teal speech-bubble logo with a flowing S, with matching SVG and PNG icons for both browser builds and the settings popup.

## [3.1.3] – 2026-11-08

- Exclude native sidebar motion from added opacity, media and hover transitions, content fades, and toggle press/glow effects.
- Stop observing style/class changes across the page; observe popup positioning only while needed.
- Run layout smoothing once per action using translation, without animating conversation width.
- Reduce blur and streaming fade delays, and add regression coverage with all effects enabled.

## [3.1.2] – 2026-11-04

### Changed
- The settings popup and the extension description are now in English.

## [3.1.1] – 2026-11-04

### New
- **Gliding sidebar:** When collapsing, the sidebar slides out to the left and the chat follows at the same pace; when expanding, it slides back in. The title bar moves along instead of jumping.
- **Chromium browsers:** Now also runs in Chrome, Edge, Brave, Vivaldi, Helium and friends.
- **Signed releases:** The Firefox build is signed by Mozilla, the Chromium build ships as a signed CRX – both install permanently and update automatically.
- Linux installer for Chromium browsers (`install/chromium-linux.sh`), no developer mode needed.

### Changed
- Requires Firefox 142 or newer.

## [3.1.0] – 2026-11-04

### Improved
- **Menus** grow out of their button and open in the right direction (the profile menu opens upwards). The animation waits until the menu is in place and no longer plays twice.
- **New content** fades in cleanly instead of popping in late.
- **Page changes** without flashing. In the settings, switching tabs only glides in the new content; the tab bar stays put.
- **Streaming:** When the reply scrolls along, the text glides up line by line instead of jumping. Nothing fades in a second time when the reply finishes.
- **Sent messages** lift off the input box more calmly – and only when sending, not when opening old chats.
- The first message in a new chat is animated too.
- The page behind dialogs is no longer blurred (saves frames).

## [3.0.0]

- Spring physics (smooth / snappy / bouncy), word-by-word streaming, menus and dialogs, page transitions, press feedback, icon morphing, sheen and light pulse, settings popup.
