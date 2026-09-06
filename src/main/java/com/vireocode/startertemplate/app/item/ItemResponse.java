package com.vireocode.startertemplate.app.item;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/** Server representation of an Item, including server-owned optimistic version. */
public record ItemResponse(
        @NotNull UUID id,
        @NotBlank String name,
        @Schema(nullable = true) String description,
        @NotNull @PositiveOrZero Integer quantity,
        @NotNull ItemStatus status,
        @NotNull @PositiveOrZero Long version) {
}
