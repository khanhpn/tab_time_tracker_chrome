# Tab Times
<img width="507" height="603" alt="Screenshot 2026-07-07 at 05 44 58" src="https://github.com/user-attachments/assets/987bef1b-80c6-4c42-9f64-7b6f820d309b" />

Tab Times is a Chrome extension for tracking active time across the tabs you have visited. It keeps a live ranked list of tracked tabs, shows the current active tab first, and helps you notice when a tab is approaching a configurable focus limit.

The extension is built with Manifest V3, TypeScript, Vite, and Chrome's local extension storage.

## Features

- Tracks active usage time when you switch between browser tabs.
- Ranks visited tabs by active time, with the current active tab pinned to the top.
- Shows total tracked time, tracked-tab count, and the longest active session.
- Adds per-tab focus limits with warning and over-limit states.
- Lets you reset tracked time from the popup.
- Lets you focus or close tracked tabs directly from the popup.
- Keeps usage data and settings on the local device.
- Includes a standalone privacy policy page in `docs/`.

## Privacy

Tab Times is designed to run locally in Chrome. It uses tab details only to provide the visible tracking workflow in the extension popup.

The extension does not run ads, use analytics services, sell data, or send tab usage history to a remote server. Usage state and settings are stored with `chrome.storage.local`.

The privacy policy lives at [`docs/index.html`](docs/index.html).

## Install From Source

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Build the extension:

   ```sh
   pnpm build
   ```

3. Open Chrome and go to:

   ```text
   chrome://extensions
   ```

4. Enable **Developer mode**.

5. Click **Load unpacked** and select the generated `dist/` folder.

6. Pin **Tab Times** from the Chrome toolbar and open the popup.

## Development

Use the watch build while developing:

```sh
pnpm dev
```

After changes are built, reload the unpacked extension from `chrome://extensions`.

Useful checks:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

Format the project:

```sh
pnpm format
```

## Project Structure

```text
public/
  manifest.json        Chrome extension manifest
  icons/               Extension icons
src/
  background.ts        Manifest V3 service worker and Chrome event handling
  popup.ts             Popup rendering and user interactions
  tracker.ts           Core tab-time tracking logic
  messages.ts          Runtime message types
  styles.css           Popup styling
docs/
  index.html           Privacy policy page
tests/
  tracker.test.ts      Unit tests for tracking behavior
popup.html             Popup entry HTML
vite.config.ts         Extension build configuration
```

## Chrome Permissions

Tab Times requests the permissions needed for its core workflow:

- `tabs`: read active tab details, update focused tabs, and close tabs from the popup.
- `storage`: save usage history and settings locally in Chrome.
- `windows`: focus the correct Chrome window when opening a tracked tab.

## Release Build

Create a production build:

```sh
pnpm build
```

For Chrome Web Store upload, package the contents of `dist/`, not the parent folder:

```sh
cd dist
zip -r ../tab-times.zip .
```

Before uploading, make sure the version in `public/manifest.json` is updated for the new release.

## License

MIT
