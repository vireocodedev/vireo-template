package com.vireocode.startertemplate.app.item;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.openapitools.jackson.nullable.JsonNullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vireocode.startertemplate.app.auth.AppCurrentUser;
import com.vireocode.startertemplate.app.history.AppHistoryEntityType;
import com.vireocode.vireo.base.BaseRequestService;
import com.vireocode.vireo.base.EntityConfig;
import com.vireocode.vireo.web.RestUtils;

@Service
public class ItemService extends BaseRequestService<UUID, Item, ItemCreateRequest, ItemPatchRequest, ItemResponse> {

    private final ItemRepository itemRepository;
    private final ItemMapper itemMapper;
    private final AppCurrentUser currentUser;

    public ItemService(ItemRepository repository, ItemMapper mapper, AppCurrentUser currentUser) {
        super(repository, mapper, EntityConfig.builder()
                .localSearchableFields(List.of("name", "description", "status"))
                .softDelete(true)
                .history(AppHistoryEntityType.ITEM)
                .build());
        this.itemRepository = repository;
        this.itemMapper = mapper;
        this.currentUser = currentUser;
    }

    @Override
    protected void validateCreateRequest(ItemCreateRequest request) {
        currentUser.requireCanManageItems();
        validateCreatePayload(request);
        if (itemRepository.existsById(request.id())) {
            throw RestUtils.conflict("An Item with this id already exists.");
        }
    }

    @Override
    protected Item buildCreateDomain(ItemCreateRequest request) {
        Item domain = super.buildCreateDomain(request);
        domain.setId(request.id());
        return domain;
    }

    @Override
    protected void validatePatchRequest(UUID id, ItemPatchRequest request) {
        currentUser.requireCanManageItems();
        validateReplayPatch(request);
        requireCurrentVersion(id, request.version());
    }

    @Override
    protected void validateDeleteRequest(UUID id) {
        currentUser.requireCanManageItems();
    }

    /**
     * Uses the same service boundary as REST and replay. A stale write is a
     * permanent conflict rather than an implicit last-write-wins update.
     */
    @Transactional
    public void deleteWithVersion(UUID id, long version) {
        currentUser.requireCanManageItems();
        validateDeleteVersion(version);
        requireCurrentVersion(id, version);
        super.delete(id);
    }

    /** Validates a replay create before its idempotency state is inspected. */
    public void validateReplayCreate(ItemCreateRequest request) {
        validateCreatePayload(request);
    }

    /** Validates a replay PATCH before its idempotency state is inspected. */
    public void validateReplayPatch(ItemPatchRequest request) {
        requireVersion(request.version());
        validatePatchFields(request);
        if (!hasPatchChanges(request)) {
            throw RestUtils.badRequest("Item PATCH must include at least one mutable field.");
        }
    }

    /** Validates a replay delete before an absent or tombstoned row is considered applied. */
    public void validateDeleteVersion(Long version) {
        if (version == null || version < 0) {
            throw RestUtils.badRequest("Item version is required and must not be negative.");
        }
    }

    /**
     * A replayed create is the only route that can restore a tombstone. It is
     * intentionally a complete create representation, not a partial PATCH.
     */
    @Transactional
    public ItemResponse restore(ItemCreateRequest request) {
        currentUser.requireCanManageItems();
        validateCreatePayload(request);
        Item tombstone = itemRepository.findById(request.id())
                .filter(Item::isDeleted)
                .orElseThrow(() -> RestUtils.conflict("An active Item with this id already exists."));

        ItemResponse previous = snapshotForHistory(tombstone);
        Item restoredState = itemMapper.toDomain(request);
        tombstone.setName(restoredState.getName());
        tombstone.setDescription(restoredState.getDescription());
        tombstone.setQuantity(restoredState.getQuantity());
        tombstone.setStatus(restoredState.getStatus());
        tombstone.setDeleted(false);
        populateKeywords(tombstone);
        Item restored = itemRepository.saveAndFlush(tombstone);
        return finalizePatchedEntity(restored, previous);
    }

    /** Read including a soft-deleted row for idempotent replay classification. */
    public Optional<Item> findIncludingDeleted(UUID id) {
        return itemRepository.findById(id);
    }

    /** Requested persisted create state is enough to classify an uncertain replay as applied. */
    public boolean matches(Item current, ItemCreateRequest requested) {
        return current != null
                && !current.isDeleted()
                && Objects.equals(current.getId(), requested.id())
                && Objects.equals(current.getName(), requested.name())
                && Objects.equals(current.getDescription(), requested.description())
                && Objects.equals(current.getQuantity(), requested.quantity())
                && current.getStatus() == requested.status();
    }

    /** A successful PATCH may be replayed safely when all explicitly changed values already match. */
    public boolean matches(Item current, ItemPatchRequest requested) {
        return current != null
                && !current.isDeleted()
                && hasPatchChanges(requested)
                && requested.version() != null
                && requested.version() < Long.MAX_VALUE
                && Objects.equals(current.getVersion(), requested.version() + 1)
                && matchesIfPresent(requested.name(), current.getName())
                && matchesIfPresent(requested.description(), current.getDescription())
                && matchesIfPresent(requested.quantity(), current.getQuantity())
                && matchesIfPresent(requested.status(), current.getStatus());
    }

    private void validatePatchFields(ItemPatchRequest request) {
        validateRequiredString(request.name(), "Item name", 255);
        validateOptionalString(request.description(), "Item description", 2000);
        validateRequiredQuantity(request.quantity());
        validateRequiredStatus(request.status());
    }

    private boolean hasPatchChanges(ItemPatchRequest request) {
        return isPresent(request.name())
                || isPresent(request.description())
                || isPresent(request.quantity())
                || isPresent(request.status());
    }

    private void validateCreatePayload(ItemCreateRequest request) {
        if (request.id() == null) {
            throw RestUtils.badRequest("Item id is required.");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw RestUtils.badRequest("Item name must not be blank.");
        }
        if (request.name().length() > 255) {
            throw RestUtils.badRequest("Item name exceeds its maximum length.");
        }
        if (request.description() != null && request.description().length() > 2000) {
            throw RestUtils.badRequest("Item description exceeds its maximum length.");
        }
        if (request.quantity() == null || request.quantity() < 0) {
            throw RestUtils.badRequest("Item quantity must be zero or greater.");
        }
        if (request.status() == null) {
            throw RestUtils.badRequest("Item status is required.");
        }
    }

    private void validateRequiredString(JsonNullable<String> value, String field, int maximumLength) {
        if (!isPresent(value)) {
            return;
        }
        String text = value.orElse(null);
        if (text == null || text.isBlank()) {
            throw RestUtils.badRequest(field + " must not be blank.");
        }
        if (text.length() > maximumLength) {
            throw RestUtils.badRequest(field + " exceeds its maximum length.");
        }
    }

    private void validateOptionalString(JsonNullable<String> value, String field, int maximumLength) {
        if (isPresent(value) && value.orElse(null) != null && value.orElse(null).length() > maximumLength) {
            throw RestUtils.badRequest(field + " exceeds its maximum length.");
        }
    }

    private void validateRequiredQuantity(JsonNullable<Integer> value) {
        if (!isPresent(value)) {
            return;
        }
        Integer quantity = value.orElse(null);
        if (quantity == null || quantity < 0) {
            throw RestUtils.badRequest("Item quantity must be zero or greater.");
        }
    }

    private void validateRequiredStatus(JsonNullable<ItemStatus> value) {
        if (isPresent(value) && value.orElse(null) == null) {
            throw RestUtils.badRequest("Item status is required.");
        }
    }

    private boolean isPresent(JsonNullable<?> value) {
        return value != null && value.isPresent();
    }

    private boolean matchesIfPresent(JsonNullable<?> requested, Object current) {
        return !isPresent(requested) || Objects.equals(requested.orElse(null), current);
    }

    private void requireVersion(Long version) {
        if (version == null || version < 0) {
            throw RestUtils.badRequest("Item version is required and must not be negative.");
        }
    }

    private void requireCurrentVersion(UUID id, long requestedVersion) {
        Item current = itemRepository.findById(id)
                .filter(item -> !item.isDeleted())
                .orElseThrow(() -> RestUtils.notFound("id", String.valueOf(id)));
        if (!Objects.equals(current.getVersion(), requestedVersion)) {
            throw RestUtils.conflict("The Item has changed on the server.");
        }
    }
}
