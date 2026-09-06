# API, query, and offline

Each server-backed feature separates:

- `<feature>.api.ts`: transport-independent interface.
- `<feature>.api.online.ts`: online implementation, response parsing, and request mapping.
- `<feature>.query.ts`: query keys, query options, and cache policy.
- focused hooks: UI-facing orchestration and mutations.

Pages and components consume feature hooks through `public.ts`; they do not instantiate clients or call online implementations. TanStack Query owns server state, URL state owns shareable list state, TanStack Form owns form state, and local React state owns ephemeral UI state. Server data is never mirrored into another store.

`app/data/network` owns transport, normalized errors, session expiry, and parsing diagnostics. `app/data/query` owns the query client and global query policy. Entity endpoints never live there.

Offline support remains feature-owned: an offline adapter implements the same feature API and owns its queue, reconciliation, and storage model. For an authenticated HTTP application, only the backend heartbeat received through SSE changes `sigConnectivityStatus`; browser hints, ordinary HTTP responses, and the EventSource connection state do not prove connectivity. The offline simulator may force this signal to `OFFLINE`, and returning from simulation waits for the next heartbeat before reporting `ONLINE`.
