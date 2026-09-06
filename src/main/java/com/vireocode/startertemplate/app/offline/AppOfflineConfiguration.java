package com.vireocode.startertemplate.app.offline;

import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.annotation.Order;

import com.vireocode.startertemplate.app.auth.AppCurrentUser;
import com.vireocode.startertemplate.app.auth.AppUserRole;
import com.vireocode.startertemplate.app.item.ItemResponse;
import com.vireocode.startertemplate.app.item.ItemService;
import com.vireocode.vireo.offline.OfflineActor;
import com.vireocode.vireo.offline.OfflineActorResolver;
import com.vireocode.vireo.offline.OfflineHeartbeatService;
import com.vireocode.vireo.offline.OfflineSseAudienceResolver;
import com.vireocode.vireo.spi.OfflineChangeBroadcaster;

import tools.jackson.databind.ObjectMapper;

/** Application policy for the Template's one admitted offline domain: Item. */
@Configuration(proxyBeanMethods = false)
public class AppOfflineConfiguration {

    static final String ITEM_AUDIENCE = "template-item-readers";

    @Bean
    OfflineActorResolver appOfflineActorResolver(AppCurrentUser currentUser) {
        return () -> currentUser.resolve().map(user -> new OfflineActor(
                user.id(), user.username(), AppUserRole.SUPERADMIN.name().equals(user.role())));
    }

    @Bean
    OfflineSseAudienceResolver appOfflineSseAudienceResolver(AppCurrentUser currentUser) {
        return () -> currentUser.resolve()
                .filter(user -> AppUserRole.USER.name().equals(user.role())
                        || AppUserRole.SUPERADMIN.name().equals(user.role()))
                .map(ignored -> ITEM_AUDIENCE);
    }

    /**
     * Core broadcasts DTOs generically. The Template deliberately narrows its
     * admitted Item event payload to identity and optimistic version metadata.
     * Generated entities therefore remain online-only.
     */
    @Bean
    @Primary
    OfflineChangeBroadcaster appOfflineChangeBroadcaster(OfflineHeartbeatService heartbeatService) {
        return new ItemOnlyOfflineChangeBroadcaster(heartbeatService);
    }

    @Bean
    @Order(10)
    ItemOfflineReplayHandler itemOfflineReplayHandler(ObjectMapper objectMapper, ItemService items,
            AppCurrentUser currentUser) {
        return new ItemOfflineReplayHandler(objectMapper, items, currentUser);
    }

    private static final class ItemOnlyOfflineChangeBroadcaster implements OfflineChangeBroadcaster {

        private final OfflineHeartbeatService delegate;

        private ItemOnlyOfflineChangeBroadcaster(OfflineHeartbeatService delegate) {
            this.delegate = delegate;
        }

        @Override
        public void publishCreateEvent(String entity, Object payload, Long revision) {
            itemPayload(entity, payload, false).ifPresent(item -> delegate.publishCreateEvent(entity, item, revision));
        }

        @Override
        public void publishUpdateEvent(String entity, Object payload, Long revision) {
            itemPayload(entity, payload, false).ifPresent(item -> delegate.publishUpdateEvent(entity, item, revision));
        }

        @Override
        public void publishDeleteEvent(String entity, Object payload, Long revision) {
            itemPayload(entity, payload, true).ifPresent(item -> delegate.publishDeleteEvent(entity, item, revision));
        }

        private Optional<ItemSsePayload> itemPayload(String entity, Object payload, boolean deleted) {
            if (!(payload instanceof ItemResponse item) || !"Item".equals(entity)) {
                return Optional.empty();
            }
            Long version = item.version();
            // BaseService records a delete's history/SSE snapshot before the
            // soft-delete flush increments JPA's optimistic version.
            if (deleted && version != null) {
                version++;
            }
            return Optional.of(new ItemSsePayload(item.id(), version));
        }
    }
}
