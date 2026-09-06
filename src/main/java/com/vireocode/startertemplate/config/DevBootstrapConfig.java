package com.vireocode.startertemplate.config;

import java.util.UUID;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.vireocode.vireo.auth.StarterUser;
import com.vireocode.vireo.auth.StarterUserRepository;
import com.vireocode.startertemplate.app.auth.AppUserRole;
import com.vireocode.startertemplate.app.item.Item;
import com.vireocode.startertemplate.app.item.ItemRepository;
import com.vireocode.startertemplate.app.item.ItemStatus;

@Configuration
@Profile("dev")
public class DevBootstrapConfig {

    @Bean
    ApplicationRunner seedDevelopmentData(
            StarterUserRepository users,
            PasswordEncoder passwordEncoder,
            ItemRepository items) {
        return args -> {
            createUser(users, passwordEncoder, "demo", "demo123", AppUserRole.USER);
            createUser(users, passwordEncoder, "admin", "admin123", AppUserRole.SUPERADMIN);

            seedItems(items);
        };
    }

    static void seedItems(ItemRepository items) {
        if (items.count() == 0) {
            items.save(item("Portable barcode scanners", "Handheld scanners assigned to receiving and dispatch.", 18,
                    ItemStatus.ACTIVE));
            items.save(item("Thermal label rolls", "Shipping-label stock shared across both packing stations.", 4,
                    ItemStatus.ACTIVE));
            items.save(item("Safety inspection kits", "New quarterly inspection kits awaiting approval.", 2,
                    ItemStatus.DRAFT));
            items.save(item("Rugged field tablets", "Offline-capable tablets used by warehouse leads.", 11,
                    ItemStatus.ACTIVE));
            items.save(item("Cold-chain sensors", "Calibrated Bluetooth sensors for temperature-sensitive loads.", 6,
                    ItemStatus.ACTIVE));
            items.save(item("Return totes", "Reusable containers allocated to the returns workflow.", 3,
                    ItemStatus.DRAFT));
            items.save(item("Dock safety cones", "High-visibility cones distributed across active loading bays.", 24,
                    ItemStatus.ACTIVE));
            items.save(item("Legacy handheld terminals", "Retired devices retained for audit history.", 0,
                    ItemStatus.ARCHIVED));
        }
    }

    static void createUser(StarterUserRepository users, PasswordEncoder encoder, String username,
            String password, AppUserRole role) {
        if (users.existsByUsername(username)) {
            return;
        }
        StarterUser user = new StarterUser();
        user.setUsername(username);
        user.setPasswordHash(encoder.encode(password));
        user.setRole(role.name());
        user.setEnabled(true);
        users.save(user);
    }

    private static Item item(String name, String description, int quantity, ItemStatus status) {
        Item item = new Item();
        item.setId(UUID.randomUUID());
        item.setName(name);
        item.setDescription(description);
        item.setQuantity(quantity);
        item.setStatus(status);
        return item;
    }
}
