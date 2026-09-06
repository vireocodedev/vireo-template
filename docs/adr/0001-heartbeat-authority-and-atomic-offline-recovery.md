# Heartbeat authority and atomic offline recovery

An authenticated SSE heartbeat is the application's sole proof that it is online: simulation may force an offline state, but disabling simulation cannot declare the application online. The first heartbeat after each stream reconnection starts one coalesced recovery, and a single origin-wide lock protects validation, replay, and hydration as one ordered operation; this trades a short recovery pause for deterministic cache and queue state across tabs.
