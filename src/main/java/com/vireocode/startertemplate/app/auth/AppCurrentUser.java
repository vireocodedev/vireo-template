package com.vireocode.startertemplate.app.auth;

import java.util.Optional;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.vireocode.vireo.auth.StarterUserRepository;
import com.vireocode.vireo.web.RestUtils;

/**
 * Application-owned current-user lookup. Offline ownership uses the immutable
 * user UUID, while username remains display-only data.
 */
@Component
public class AppCurrentUser {

    private final StarterUserRepository users;

    public AppCurrentUser(StarterUserRepository users) {
        this.users = users;
    }

    public Optional<AppCurrentUserResponse> resolve() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getName() == null || authentication.getName().isBlank()) {
            return Optional.empty();
        }

        return users.findByUsername(authentication.getName())
                .filter(user -> user.isEnabled())
                .map(user -> new AppCurrentUserResponse(user.getId(), user.getUsername(), user.getRole()));
    }

    public AppCurrentUserResponse require() {
        return resolve().orElseThrow(() -> RestUtils.unauthorized("Unauthorized"));
    }

    public void requireCanManageItems() {
        if (!AppUserRole.SUPERADMIN.name().equals(require().role())) {
            throw new AccessDeniedException("Item management requires SUPERADMIN.");
        }
    }

    public record AppCurrentUserResponse(UUID id, String username, String role) {
    }
}
