package com.vireocode.startertemplate.app.item;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/** Version precondition for a soft-delete that can be safely replayed. */
public record ItemDeleteRequest(@NotNull @PositiveOrZero Long version) {
}
