# Slope build provenance

Source: https://github.com/slope-pro/slope-pro.github.io/tree/main/slope-github
Source commit: aca24247601920c3d1c16860b607ceffc1a13bef
Product metadata: Slope, Y8, version 1.2; Unity 2020.3.23f1 loader.
The site owner confirmed permission to copy and host this build in the project conversation on 30 October 2026. This note does not grant redistribution rights to others. Original ownership and notices remain applicable.

Game data and WebAssembly are unchanged. Files use flat names for the existing GitHub Pages deployment. The framework’s SDK path was updated accordingly. The SDK’s fabricated hard-coded success/session response was removed and its real request path restored, with a 15-second timeout. No origin or account checks are bypassed. Optional publisher accounts, ads and online services may contact their providers; they are separate from Pixel Arcade accounts and may be unavailable.

The custom launcher includes a click-to-load screen, WebGL preflight, progress, loading-error recovery, viewport-sized canvas and fullscreen. The broken /cloak.js reference from the supplied page is not used. Uncompressed .wasm and .data files are served as such; the upstream .gz copies were not actually compressed and are omitted.

Validation: node slope-loader.test.mjs checks unsupported graphics, startup, duplicate-click prevention, loader failure, Unity rejection and project-path asset resolution. Full gameplay still requires a browser with working WebGL.
