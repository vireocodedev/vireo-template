package com.vireocode.startertemplate.app.offline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.vireocode.startertemplate.app.item.ItemResponse;
import com.vireocode.startertemplate.app.item.ItemStatus;
import com.vireocode.vireo.offline.OfflineHeartbeatService;
import com.vireocode.vireo.spi.OfflineChangeBroadcaster;

class AppOfflineConfigurationTest {

    @Test
    @DisplayName("Item SSE batches retain only identity and optimistic version metadata")
    void itemChangesUseMinimalPayload() {
        OfflineHeartbeatService heartbeat = mock(OfflineHeartbeatService.class);
        OfflineChangeBroadcaster broadcaster = new AppOfflineConfiguration().appOfflineChangeBroadcaster(heartbeat);
        UUID itemId = UUID.randomUUID();

        broadcaster.publishUpdateEvent("Item", new ItemResponse(itemId, "Name", "Description", 1,
                ItemStatus.ACTIVE, 4L), 9L);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(heartbeat).publishUpdateEvent(eq("Item"), payload.capture(), eq(9L));
        assertThat(payload.getValue()).isEqualTo(new ItemSsePayload(itemId, 4L));
    }

    @Test
    @DisplayName("soft-delete SSE metadata reports the post-delete optimistic version")
    void deleteUsesTheAdvancedVersion() {
        OfflineHeartbeatService heartbeat = mock(OfflineHeartbeatService.class);
        OfflineChangeBroadcaster broadcaster = new AppOfflineConfiguration().appOfflineChangeBroadcaster(heartbeat);
        UUID itemId = UUID.randomUUID();

        broadcaster.publishDeleteEvent("Item", new ItemResponse(itemId, "Name", "Description", 1,
                ItemStatus.ACTIVE, 4L), 9L);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(heartbeat).publishDeleteEvent(eq("Item"), payload.capture(), eq(9L));
        assertThat(payload.getValue()).isEqualTo(new ItemSsePayload(itemId, 5L));
    }

    @Test
    @DisplayName("generated entities do not become SSE/offline entities by accident")
    void nonItemChangesAreDiscarded() {
        OfflineHeartbeatService heartbeat = mock(OfflineHeartbeatService.class);
        OfflineChangeBroadcaster broadcaster = new AppOfflineConfiguration().appOfflineChangeBroadcaster(heartbeat);

        broadcaster.publishCreateEvent("PurchaseOrder", new Object(), 1L);

        verify(heartbeat, never()).publishCreateEvent(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
