# Pixel Arcade

A browser arcade with original game links, embedded games, custom HTML uploads, chess bots, a scientific calculator, music and built-in community chat.

## Hosting on GitHub Pages

The ready-to-publish site is in the repository root. No Node install or build step is needed.

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then Save.
5. Wait for GitHub to finish the Pages deployment. GitHub reports the published URL in Settings → Pages.

Works at both a project path (`https://USERNAME.github.io/pixel-arcade/`) and a user-site root (`https://USERNAME.github.io/`). URL availability is determined by the GitHub account and repository name.

## Application services

Every application screen is served by this GitHub Pages repository. Accounts, profiles, shared playtime, chat servers/channels and the developer TV gate use authenticated calls from api-client.js to the Pixel service backend; visitors are not redirected to another arcade site. Existing accounts and chat data remain intact.

GitHub Pages cannot execute a server or database. The service runs separately with the existing database, using an exact GitHub-origin allowlist and short-lived bearer sessions. It never accepts the hosted site's cookie as a GitHub session. No private token, password hash or runtime secret is shipped in this repository. The portable backend implementation and SQL schema are included in backend-worker.ts and backend-schema.sql; see BACKEND.md.

Games, media, external browsing and general AI still use their providers inside the interface. The AI provider's own sign-in popup remains necessary. Pages includes no outgoing alternative-site links such as “Open Calculator 2”.

## Updating the site

Edit the website files and commit to main. GitHub Pages publishes the updates automatically. Asset names use flat prefixes such as `icons-` and `vendor-`.

## Credits

External games and media belong to their respective creators. Sources remain recorded in `originals.json` and `catalog.js`. Chess.js and mathjs license notices are in the `vendor-*-LICENSE` files.

## User manual and new tools

Open [User manual](manual.html) from the site sidebar for instructions, examples, data-storage details and troubleshooting. It can be printed or saved as PDF using the browser print dialog.

The calculator includes Standard, Scientific, History export, Symbolic algebra, Equations, Polynomials, Matrices (including QR decomposition), Vectors, Derivatives, Integrals, numerical first-order differential equations, QR Grapher (explicit functions and implicit relations), Statistics, Regression, Complex, 16–100 digit BigNumber precision, Constants and Units. Its engines run locally in disposable time-limited Web Workers. Numerical plots, integral estimates and ODE solutions have the limitations explained in the interface. Nerdamer 1.1.13 is vendored with its MIT license in vendor-nerdamer-LICENSE.

Pixel AI is a real general chat integration using Puter.js. Visitors connect their own Puter account. Their allowance/credits and provider terms apply; the repository has no private API key. Messages and recent context go to Puter and its AI provider only when submitted. This app keeps the conversation in tab memory, not localStorage; clearing the view does not erase provider records. The SDK loads lazily on the AI page. The existing Arcade helper remains a separate scripted catalogue guide.

Light, dark and device-based themes save locally. Cover, optional cover-on-tab-switch and Quick exit change the visible screen; they do not conceal network activity or device monitoring.

## Chat appearance

Pixel Chat uses a full-window server/channel/message/member layout, grouped messages, avatar colours, emoji insertion, channel drafts in tab memory, pinned-message viewing and responsive sidebars. It uses the existing chat API and moderation rules. Themes offers eight saved palettes with light/dark/device modes. Reflection dimming applies to rendered page and player surfaces, with immediate controls and 20–85% strength. Generic blank-tab wrappers rely on the inner arcade for dimming so the effect is not applied twice; the direct Minecraft wrapper dims its own iframe.

## Community features
Friends & DMs includes accepted friend requests, private conversations, custom profile cards and blocking. Party rooms support Chess, Tic Tac Toe, Connect Four and Dots & Boxes with server-validated turns. Daily Lights Out changes at Sydney midnight and has daily/all-time leaderboards based on validated moves. Moderation includes content reports, report snapshots, public slow mode, mutes and community suspensions. See the in-site user manual for controls, privacy details and limitations.

## Password reset
Account includes Forgot password, Change password and private recovery-code setup. New players receive a code after signup. The configured administrator can issue a 15-minute one-use reset code for another player after confirming their own password and independently verifying the player’s identity. A successful reset signs out every existing session and replaces the recovery code. See the user manual.

## Compact navigation
The home page uses compact shortcuts for chat, calculator, chess, friends, parties, daily challenges and AI. Secondary tools and media are grouped in expandable sidebar menus. More (•••) in the header holds themes, dimming, stats, favourites and the quick tour. On small screens the menu button opens the navigation drawer. All existing feature handlers and account/security controls are retained.

## Interactive onboarding
A cinematic, replayable welcome screen features a live canvas sculpture with Orbit, Bloom and Wave modes, pointer tilt, drag rotation, tap/keyboard ripples, pause/resume and reduced-motion support. Enter or skip at any time, or launch the action-based ten-step guided setup. Preferences apply to the real app; tool steps check actual interactions. Progress can be paused/resumed locally. The tour replaces the automatic static tutorial and supports reduced motion.

## Marketplace, profiles and roles
The account-backed marketplace includes 110 original CSS/vector cosmetics, owned inventory, live previews, one frame/effect/name colour and two title slots. Earn coins through capped server-validated chat, active time and one-time achievements. Purchases and gifts use an atomic ledger and reject insufficient balances, duplicates and unowned equipment. Profile editing supports live previews, resized avatars, pronouns, view counts and chat totals. Admin-managed custom roles have colours, ranks and an explicit moderator permission; they cannot grant administrator/password-reset access. Dock icons magnify with pointer proximity and keyboard focus, respecting reduced motion.

## GTA V and browser connection recovery
The supplied GTA V browser build has a high-end-device card badge and a pre-download WebGPU check. It opens in its own provider tab because its COOP/COEP isolation requirements cannot be supplied by the GitHub Pages embedded player. No game assets are copied into the repository. Direct and Scramjet browser modes preserve entered history/bookmarks, with Retry and an explicit Direct fallback. Frame responses are not reported as verified content success, and an 18-second waiting message covers stalled loads. Network restrictions and cross-origin embedding remain outside the arcade’s control.
