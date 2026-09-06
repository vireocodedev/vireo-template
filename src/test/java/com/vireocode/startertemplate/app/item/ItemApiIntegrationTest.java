package com.vireocode.startertemplate.app.item;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.vireocode.vireo.auth.StarterUser;
import com.vireocode.vireo.auth.StarterUserRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ItemApiIntegrationTest {

    private final MockMvc mockMvc;
    private final ItemRepository items;
    private final JdbcTemplate jdbc;
    private final StarterUserRepository users;

    @Autowired
    ItemApiIntegrationTest(MockMvc mockMvc, ItemRepository items, JdbcTemplate jdbc, StarterUserRepository users) {
        this.mockMvc = mockMvc;
        this.items = items;
        this.jdbc = jdbc;
        this.users = users;
    }

    @BeforeEach
    void createAuthenticatedTestUser() {
        if (users.existsByUsername("user")) {
            return;
        }
        StarterUser user = new StarterUser();
        user.setUsername("user");
        user.setPasswordHash("test-hash");
        user.setRole("SUPERADMIN");
        user.setEnabled(true);
        users.save(user);
    }

    @Test
    @WithMockUser(roles = "SUPERADMIN")
    @DisplayName("Item API supports its complete create, search, update, and delete lifecycle")
    void itemLifecycle() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(post("/api/items")
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "id": "%s",
                          "name": "Lifecycle proof",
                          "description": "Created by the API integration contract.",
                          "quantity": 3,
                          "status": "DRAFT"
                        }
                        """.formatted(id)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.name").value("Lifecycle proof"));

        Item created = items.findAll().stream()
                .filter(item -> "Lifecycle proof".equals(item.getName()))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(post("/api/items/search")
                .with(csrf())
                .queryParam("searchText", "Lifecycle proof")
                .contentType("application/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(created.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("DRAFT"));

        mockMvc.perform(patch("/api/items/{id}", created.getId())
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "name": "Lifecycle proof updated",
                          "description": null,
                          "quantity": 8,
                          "status": "ACTIVE",
                          "version": %d
                        }
                        """.formatted(created.getVersion())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.getId().toString()))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.name").value("Lifecycle proof updated"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        Item updated = items.findById(created.getId()).orElseThrow();
        mockMvc.perform(delete("/api/items/{id}", created.getId())
                .with(csrf())
                .contentType("application/json")
                .content("""
                        { "version": %d }
                        """.formatted(updated.getVersion())))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/items/search")
                .with(csrf())
                .queryParam("searchText", "Lifecycle proof updated")
                .contentType("application/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    @WithMockUser(roles = "SUPERADMIN")
    @DisplayName("Item API rejects structurally invalid writes")
    void createRejectsInvalidPayload() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(post("/api/items")
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "id": "%s",
                          "name": "",
                          "quantity": -1,
                          "status": null
                        }
                        """.formatted(id)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "SUPERADMIN")
    @DisplayName("Item API rejects stale optimistic versions without overwriting server state")
    void updateRejectsStaleVersion() throws Exception {
        UUID id = UUID.randomUUID();
        Item item = new Item();
        item.setId(id);
        item.setName("Version proof");
        item.setQuantity(1);
        item.setStatus(ItemStatus.ACTIVE);
        items.saveAndFlush(item);

        mockMvc.perform(patch("/api/items/{id}", id)
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "name": "Stale overwrite",
                          "description": null,
                          "quantity": 4,
                          "status": "ACTIVE",
                          "version": 99
                        }
                        """))
                .andExpect(status().isConflict());

        assertThat(items.findById(id).orElseThrow().getName()).isEqualTo("Version proof");
    }

    @Test
    @WithMockUser(roles = "SUPERADMIN")
    @DisplayName("Item PATCH retains omitted fields and clears an explicitly null description")
    void patchUsesJsonNullablePresence() throws Exception {
        UUID id = UUID.randomUUID();
        Item item = new Item();
        item.setId(id);
        item.setName("Partial update proof");
        item.setDescription("Will be cleared");
        item.setQuantity(5);
        item.setStatus(ItemStatus.DRAFT);
        items.saveAndFlush(item);

        mockMvc.perform(patch("/api/items/{id}", id)
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "version": 0,
                          "description": null
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.name").value("Partial update proof"))
                .andExpect(jsonPath("$.quantity").value(5))
                .andExpect(jsonPath("$.version").value(1));
    }

    @Test
    @WithMockUser(roles = "SUPERADMIN")
    @DisplayName("Item API rejects values beyond the database column contract before persistence")
    void createRejectsValuesBeyondColumnContract() throws Exception {
        long before = items.count();
        UUID id = UUID.randomUUID();

        mockMvc.perform(post("/api/items")
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {
                          "id": "%s",
                          "name": "%s",
                          "description": "%s",
                          "quantity": 1,
                          "status": "ACTIVE"
                        }
                        """.formatted(id, "n".repeat(256), "d".repeat(2001))))
                .andExpect(status().isBadRequest());

        assertThat(items.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("Database constraints retain the same blank-name and quantity invariants")
    void databaseRejectsValuesOutsideApiContract() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO item (id, name, description, quantity, status, deleted)
                VALUES (?, '   ', NULL, -1, 'ACTIVE', FALSE)
                """, UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Item API rejects unauthenticated access")
    void searchRejectsUnauthenticatedAccess() throws Exception {
        mockMvc.perform(post("/api/items/search").with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
