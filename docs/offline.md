# Offline behavior

The Template is offline-capable for the `Item` feature. Generated CRUD and Item history remain online-only.

## Connectivity

A validated SSE `heartbeat` is the only event that marks the application online. The application starts offline and returns offline after 12 seconds without a heartbeat.

`navigator.onLine`, an opened SSE connection, and successful REST responses do not control connectivity.

The canonical Nginx route for `/api/offline/heartbeat/stream` uses HTTP/1.1, disables proxy buffering and caching, and waits 60 seconds for a response. A replacement proxy must preserve the backend's `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers, avoid buffering or caching the stream, and use an idle/read timeout safely above the 5-second heartbeat interval.

The Offline Settings simulator disables the stream for the current browser tab. It exercises the same heartbeat-expiry path as a real outage.

## Local data

After initialization, Item lists are rendered from application-owned SQLite in OPFS. Item cache rows use permanent UUIDs and optimistic versions.

Online Item mutations use REST and update SQLite after success. Offline mutations, or REST mutations that fail because of a network error or `503`, atomically update SQLite and append an ordered replay command.

The service worker keeps `/api` routes `NetworkOnly`. Authenticated API responses are never stored in a generic Workbox cache.

## Reconnection

The first valid heartbeat after an offline period starts this sequence:

1. Revalidate the cached stable user identity and role.
2. Replay queued Item commands in order.
3. Hydrate all Item pages from REST into SQLite.

Only one tab performs replay and hydration at a time through the Web Locks API. Reads remain available while this runs; Item mutations are temporarily disabled.

Transient replay failures retry with bounded backoff. Permanent rejection pauses replay and marks the optimistic row as a conflict. Replayed creates are `POST` requests with the client UUID; updates are `PATCH` requests with the path UUID and optimistic version only in the body. **Rebase and retry** turns a colliding create into a complete PATCH at the authoritative version. A PATCH whose Item was deleted or is missing becomes a create only when a complete cached Item state remains; consecutive PATCHes then coalesce into that one complete create so a hidden tombstone version cannot conflict with later local intent. Otherwise retry stops with an explicit failure. **Keep server changes** discards the local queue and optimistic rows before hydration.

## Identity and authorization

Offline access requires a successfully cached identity containing only the stable user ID, username, role, and validation time. It expires after 24 hours.

`USER` can read cached Items. `SUPERADMIN` can also queue Item mutations. The backend reauthorizes every replayed command.

Switching to a different stable user ID purges the previous user's local data. Logout with pending or failed work requires confirmation and then purges it.

## Limits and recovery

- First sign-in requires the backend.
- Item history requires the backend.
- Generated entities remain online-only until explicitly admitted.
- The client queue is limited to 1,000 commands.
- OPFS requires a cross-origin-isolated page served from HTTPS or localhost. Reload after changing the COOP/COEP headers because an open document cannot acquire isolation later.
- OPFS failure produces an explicit online-only state; production does not silently fall back to memory.
- Reset Offline Data clears the Item cache, queue, failures, hydration state, and stored owner. It keeps application preferences and the active online session.
- There is no custom application-level encryption for local Item data.

For the reusable design and implementation patterns, see the Vireo UI/UX Handbook documents for offline-capable apps and server-sent events.
