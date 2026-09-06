package com.vireocode.startertemplate.app.offline;

import java.util.UUID;

/** Minimal Item payload inside Vireo's transactional SSE batch envelope. */
public record ItemSsePayload(UUID id, Long version) {
}
