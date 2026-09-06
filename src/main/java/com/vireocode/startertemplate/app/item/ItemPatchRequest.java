package com.vireocode.startertemplate.app.item;

import org.openapitools.jackson.nullable.JsonNullable;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Partial Item update. Omitted mutable fields retain their current value;
 * explicit null is accepted only for the nullable description field.
 */
public record ItemPatchRequest(
        @NotNull @PositiveOrZero Long version,
        JsonNullable<@NotBlank @Size(max = 255) String> name,
        JsonNullable<@Size(max = 2000) String> description,
        JsonNullable<@PositiveOrZero Integer> quantity,
        JsonNullable<@NotNull ItemStatus> status) {
}
