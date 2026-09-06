package com.vireocode.startertemplate.app.offline;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.http.HttpMethod;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import com.vireocode.startertemplate.app.item.Item;
import com.vireocode.startertemplate.app.item.ItemCreateRequest;
import com.vireocode.startertemplate.app.item.ItemDeleteRequest;
import com.vireocode.startertemplate.app.item.ItemPatchRequest;
import com.vireocode.startertemplate.app.item.ItemService;
import com.vireocode.startertemplate.app.auth.AppCurrentUser;
import com.vireocode.vireo.offline.OfflineSyncBodyNormalizer;
import com.vireocode.vireo.offline.OfflineSyncCommandDto;
import com.vireocode.vireo.offline.OfflineSyncCommandResultDto;
import com.vireocode.vireo.offline.OfflineSyncReplayHandler;
import com.vireocode.vireo.offline.OfflineSyncResultReason;

import tools.jackson.databind.ObjectMapper;

/**
 * Replays only canonical Item REST commands. It invokes ItemService directly so
 * validation, authorization, optimistic locking, history, revisions, and
 * after-commit SSE delivery stay identical to ordinary REST writes.
 */
public class ItemOfflineReplayHandler implements OfflineSyncReplayHandler {

    private static final String ITEM_COLLECTION_PATH = "/api/items";
    private static final Pattern ITEM_PATH = Pattern.compile(
            "^/api/items/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");

    private final ObjectMapper objectMapper;
    private final ItemService items;
    private final AppCurrentUser currentUser;

    public ItemOfflineReplayHandler(ObjectMapper objectMapper, ItemService items, AppCurrentUser currentUser) {
        this.objectMapper = objectMapper;
        this.items = items;
        this.currentUser = currentUser;
    }

    @Override
    public boolean supports(OfflineSyncCommandDto command, HttpMethod method) {
        if (method == HttpMethod.POST) {
            return ITEM_COLLECTION_PATH.equals(command.url());
        }
        return (method == HttpMethod.PATCH || method == HttpMethod.DELETE)
                && ITEM_PATH.matcher(command.url()).matches();
    }

    @Override
    public OfflineSyncCommandResultDto process(OfflineSyncCommandDto command) {
        try {
            // This must precede every idempotency/classification read. A command
            // remains a write capability even when its requested state already
            // exists on the server.
            currentUser.requireCanManageItems();
            HttpMethod method = HttpMethod.valueOf(command.method().toUpperCase(java.util.Locale.ROOT));
            if (method == HttpMethod.POST) {
                return replayCreate(command);
            }
            UUID id = itemId(command.url());
            if (method == HttpMethod.PATCH) {
                return replayPatch(command, id);
            }
            if (method == HttpMethod.DELETE) {
                return replayDelete(command, id);
            }
            return rejected(command, 422, "The queued Item command is invalid.");
        } catch (AccessDeniedException exception) {
            return rejected(command, 403, "You no longer have permission to change Items.");
        } catch (ResponseStatusException exception) {
            return rejected(command, exception.getStatusCode().value(), safeMessage(exception));
        } catch (IllegalArgumentException exception) {
            return rejected(command, 422, "The queued Item command is invalid.");
        } catch (Exception exception) {
            return retryable(command, "Item replay is temporarily unavailable.");
        }
    }

    private OfflineSyncCommandResultDto replayCreate(OfflineSyncCommandDto command) throws Exception {
        ItemCreateRequest requested = body(command, ItemCreateRequest.class);
        items.validateReplayCreate(requested);
        Item existing = requested.id() == null ? null : items.findIncludingDeleted(requested.id()).orElse(null);
        if (existing != null && existing.isDeleted()) {
            items.restore(requested);
            return applied(command, 200);
        }
        if (existing != null && items.matches(existing, requested)) {
            return alreadyApplied(command);
        }
        if (existing != null) {
            return rejected(command, 409, "An Item with this id already exists with different data.");
        }
        items.create(requested);
        return applied(command, 201);
    }

    private OfflineSyncCommandResultDto replayPatch(OfflineSyncCommandDto command, UUID id) throws Exception {
        ItemPatchRequest requested = body(command, ItemPatchRequest.class);
        items.validateReplayPatch(requested);
        Item existing = items.findIncludingDeleted(id).orElse(null);
        if (existing != null && items.matches(existing, requested)) {
            return alreadyApplied(command);
        }
        items.patch(id, requested);
        return applied(command, 200);
    }

    private OfflineSyncCommandResultDto replayDelete(OfflineSyncCommandDto command, UUID id) throws Exception {
        ItemDeleteRequest requested = body(command, ItemDeleteRequest.class);
        items.validateDeleteVersion(requested.version());
        Item existing = items.findIncludingDeleted(id).orElse(null);
        if (existing == null || existing.isDeleted()) {
            return alreadyApplied(command);
        }
        items.deleteWithVersion(id, requested.version());
        return applied(command, 204);
    }

    private <T> T body(OfflineSyncCommandDto command, Class<T> type) {
        try {
            T result = OfflineSyncBodyNormalizer.treeToValue(command.body(), objectMapper, type);
            if (result == null) {
                throw new IllegalArgumentException("The queued Item command is invalid.");
            }
            return result;
        } catch (Exception exception) {
            throw new IllegalArgumentException("The queued Item command is invalid.", exception);
        }
    }

    private UUID itemId(String url) {
        Matcher matcher = ITEM_PATH.matcher(url);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("The Item URL is invalid.");
        }
        return UUID.fromString(matcher.group(1));
    }

    private OfflineSyncCommandResultDto applied(OfflineSyncCommandDto command, int status) {
        return new OfflineSyncCommandResultDto(command.commandId(), true, status, null,
                OfflineSyncResultReason.APPLIED);
    }

    private OfflineSyncCommandResultDto alreadyApplied(OfflineSyncCommandDto command) {
        return new OfflineSyncCommandResultDto(command.commandId(), true, 200, null,
                OfflineSyncResultReason.ALREADY_APPLIED);
    }

    private OfflineSyncCommandResultDto rejected(OfflineSyncCommandDto command, int status, String message) {
        return new OfflineSyncCommandResultDto(command.commandId(), false, status, message,
                OfflineSyncResultReason.REJECTED);
    }

    private OfflineSyncCommandResultDto retryable(OfflineSyncCommandDto command, String message) {
        return new OfflineSyncCommandResultDto(command.commandId(), false, 503, message,
                OfflineSyncResultReason.RETRYABLE);
    }

    private String safeMessage(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        if (status == 400) {
            return "The queued Item command is invalid.";
        }
        if (status == 404) {
            return "The Item no longer exists.";
        }
        if (status == 409) {
            return "The Item has changed on the server.";
        }
        return "The queued Item command was rejected.";
    }
}
