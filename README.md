# Pixel Arcade

A browser arcade with original game links, embedded games, custom HTML uploads, chess bots, a scientific calculator, music and Discord community links.

## Hosting on GitHub Pages

The ready-to-publish site is in the repository root. No Node install or build step is needed.

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then Save.
5. Wait for GitHub to finish the Pages deployment. GitHub reports the published URL in Settings → Pages.

Works at both a project path (`https://USERNAME.github.io/pixel-arcade/`) and a user-site root (`https://USERNAME.github.io/`). URL availability is determined by the GitHub account and repository name.

## Server-backed features

GitHub Pages serves static files. This migration keeps account sign-in, account playtime/stats, live Pixel Chat and the password-protected TV player on the existing hosted service:

https://pixel-arcade-wg-1023.aquapine16.chatgpt.site

The Pages interface links to those features explicitly. It does not fake login or store the developer password in public source. No account database, password hash, token or runtime secret is included in this repository. The existing service must remain online to use these features.

Gameplay on Pages does not sync account playtime. Chess games, favourites, notes and custom uploaded games are saved locally for the Pages origin. Browser data from the old hostname cannot transfer automatically; the old site and its browser-local data remain available there. External embedded games keep their own saves and availability.

## Updating the site

Edit the website files and commit to main. GitHub Pages publishes the updates automatically. Asset names use flat prefixes such as `icons-` and `vendor-`.

## Credits

External games and media belong to their respective creators. Sources remain recorded in `originals.json` and `catalog.js`. Chess.js and mathjs license notices are in the `vendor-*-LICENSE` files.

## User manual and new tools

Open [User manual](manual.html) from the site sidebar for instructions, examples, data-storage details and troubleshooting. It can be printed or saved as PDF using the browser print dialog.

The calculator includes Standard, Scientific, History export, Symbolic algebra, Equations, Polynomials, Matrices (including QR decomposition), Vectors, Derivatives, Integrals, numerical first-order differential equations, QR Grapher (explicit functions and implicit relations), Statistics, Regression, Complex, 16–100 digit BigNumber precision, Constants and Units. Its engines run locally in disposable time-limited Web Workers. Numerical plots, integral estimates and ODE solutions have the limitations explained in the interface. Nerdamer 1.1.13 is vendored with its MIT license in vendor-nerdamer-LICENSE.

Pixel AI is a real general chat integration using Puter.js. Visitors connect their own Puter account. Their allowance/credits and provider terms apply; the repository has no private API key. Messages and recent context go to Puter and its AI provider only when submitted. This app keeps the conversation in tab memory, not localStorage; clearing the view does not erase provider records. The SDK loads lazily on the AI page. The existing Arcade helper remains a separate scripted catalogue guide.

Light, dark and device-based themes save locally. Cover, optional cover-on-tab-switch and Quick exit change the visible screen; they do not conceal network activity or device monitoring.
