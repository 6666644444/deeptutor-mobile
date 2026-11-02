# Client architecture

The installed client owns every application screen. The server supplies authenticated APIs, jobs, streams and account data. Legacy `module` routes map to native features; there is no upstream-page login bootstrap.

`connection.ts` validates a selected origin. `SessionManager` retains one remembered account per service and serializes secure-store writes. Anonymous private services require the supported local-admin contract. `TutorClient` preserves no-redirect HTTP, explicit Bearer authentication and a disabled shared Cookie jar. WebSocket handshakes instead send the selected session as a dt_token Cookie. Native plugins replace shared cookies with that explicit session and strip the internal session marker before transmission.

A scope comprises service origin (including port), account ID and workspace ID. Workspace changes create a new client; switches retire old HTTP/WS work, drafts, downloads and exports. Reads and navigation use the scope. Credentials are stored per service/account, with the selected workspace in that record; anonymous workspace selection is kept per service.

Every upload uses the current client. Picked documents/photos are copied to client-owned temporary storage. Native share receiving is an unassigned local inbox: it stores no credentials and does not upload. Confirmation displays the selected service/account/workspace; a boundary change clears pending inbox files before installing the next client. Requests cannot complete against a retired client.

PDF, images and audio/video are downloaded through the same-origin client before native rendering. Content from another origin is rejected, including another port. Redirects are not followed with credentials. Exports are private temporary files until the user invokes the system share UI; they survive the chooser long enough for Android receivers, and are deleted when the client retires or the app next starts. Files deliberately saved to another app are outside this cache.

KaTeX, Mermaid and Chart.js render in isolated inline WebViews, using bundled resources. These views have no account or API bridge, no remote/file loading and no navigation. Only bounded numeric layout messages are accepted. They do not load the DeepTutor frontend. Content size and renderer maintenance remain preview concerns.

Feature adapters live in `src/features/`; core service/session policy stays in `src/lib/`. Future compatibility changes should consolidate API definitions there, without importing the server's frontend.

Application updates read only this client's GitHub Releases, without learning credentials. `LearningUpdates` exposes signed manifest bytes to `expo-updates` over a loopback-only protocol adapter; Expo verifies signatures, resource hashes and runtime compatibility before caching the update. Learning requests still use the selected service. Distribution and validation boundaries are documented in [updates.md](updates.md).

Chat turns resolve the selected or default model to concrete profile/model IDs before submission. The optional `server/mobile_models` extension stores API-key profiles per authenticated account, independently of workspaces, and merges them into the pinned upstream model-selection runtime. Only redacted fields return to the client. Administrator shared settings keep upstream permissions. See [installation and key handling](../server/README.md).
