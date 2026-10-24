# Pixel shared services

The browser interface is served by GitHub Pages. GitHub Pages does not run server code. The account/chat/stats API is a separate Worker backed by a D1 database. The current API connection is declared in api-client.js; it is a service call, not a navigation link.

backend-worker.ts contains a portable Cloudflare Worker implementation of the same tested endpoints. backend-schema.sql contains the schema migrations in order. Bind D1 as DB. Set the FrameX password hash, salt and signing key as runtime secrets using the exact names documented at the top of the Worker; never put their values in this repository. For a new database, apply the SQL once. For an existing database, apply only migrations not already recorded there.

The Worker allows browser calls from the exact owner origin configured by GITHUB_ORIGIN. GitHub clients send X-Pixel-Client: github-pages and authenticate with a one-day bearer token obtained through normal username/password login. Tokens are hashed in the database, kept in tab sessionStorage by the UI and revoked on logout. Cross-origin requests cannot reuse same-origin account cookies. Chat membership and owner permissions are checked on every operation.

Changing the backend host requires deploying this Worker with the database and secrets, and updating the service base URL in api-client.js. Deploying the static repository alone will not create a database. Existing data is not copied into GitHub.
