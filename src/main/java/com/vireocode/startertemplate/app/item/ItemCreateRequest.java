package com.vireocode.startertemplate.app.item;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Client input for a new Item. The UUID is client-owned for replay idempotency. */
public record ItemCreateRequest(
        @NotNull UUID id,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 2000) String description,
        @NotNull @PositiveOrZero Integer quantity,
        @NotNull ItemStatus status) {
}
