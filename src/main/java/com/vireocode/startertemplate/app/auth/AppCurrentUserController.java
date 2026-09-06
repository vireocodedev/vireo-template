package com.vireocode.startertemplate.app.auth;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vireocode.vireo.security.SecurityExpressions;

/** Stable identity contract used to scope the browser's durable offline data. */
@RestController
@RequestMapping("/api/app")
public class AppCurrentUserController {

    private final AppCurrentUser currentUser;

    public AppCurrentUserController(AppCurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @GetMapping("/current-user")
    @PreAuthorize(SecurityExpressions.IS_AUTHENTICATED)
    public AppCurrentUser.AppCurrentUserResponse currentUser() {
        return currentUser.require();
    }
}
