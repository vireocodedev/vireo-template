package com.vireocode.startertemplate.app.item;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

class ItemUuidMigrationContractTest {

    @Test
    void h2MigrationCreatesRfcUuidIdsAndCurrentHistorySnapshotShape() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:item-uuid-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
                Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE item (
                        id BIGINT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description VARCHAR(2000),
                        quantity INTEGER NOT NULL,
                        status VARCHAR(16) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE,
                        modified_at TIMESTAMP WITH TIME ZONE,
                        created_by VARCHAR(255),
                        modified_by VARCHAR(255),
                        keywords VARCHAR(2048),
                        deleted BOOLEAN NOT NULL DEFAULT FALSE
                    )
                    """);
            statement.execute("""
                    CREATE TABLE history (
                        id UUID PRIMARY KEY,
                        entity VARCHAR(32) NOT NULL,
                        entity_id VARCHAR(64) NOT NULL,
                        snapshot_previous TEXT,
                        snapshot_current TEXT
                    )
                    """);
            statement.execute("""
                    INSERT INTO item (id, name, description, quantity, status, deleted)
                    VALUES (42, 'Legacy Item', 'Retained history', 3, 'ACTIVE', FALSE)
                    """);
            statement.execute("""
                    INSERT INTO history (id, entity, entity_id, snapshot_previous, snapshot_current)
                    VALUES (
                        RANDOM_UUID(), 'ITEM', '42',
                        '{"id":42,"name":"Legacy Item","description":null,"quantity":2,"status":"DRAFT"}',
                        '{"id":42,"name":"Legacy Item","description":"Retained history","quantity":3,"status":"ACTIVE"}'
                    )
                    """);

            ScriptUtils.executeSqlScript(connection,
                    new EncodedResource(new ClassPathResource("db/vendor/h2/V4__migrate_item_ids_to_uuid.sql")));

            try (ResultSet item = statement.executeQuery("SELECT id, version FROM item")) {
                assertThat(item.next()).isTrue();
                UUID id = item.getObject("id", UUID.class);
                assertThat(id.version()).isEqualTo(4);
                assertThat(id.variant()).isEqualTo(2);
                assertThat(item.getLong("version")).isZero();

                try (ResultSet history = statement.executeQuery(
                        "SELECT entity_id, snapshot_previous, snapshot_current FROM history WHERE entity = 'ITEM'")) {
                    assertThat(history.next()).isTrue();
                    assertThat(history.getString("entity_id")).isEqualTo(id.toString());
                    assertThat(history.getString("snapshot_previous"))
                            .contains("\"id\":\"" + id + "\"")
                            .contains("\"version\":0");
                    assertThat(history.getString("snapshot_current"))
                            .contains("\"id\":\"" + id + "\"")
                            .contains("\"version\":0");
                }
            }
        }
    }

    @Test
    void postgresqlMigrationPinsRfcUuidBitsAndRewritesRetainedSnapshots() throws Exception {
        String migration = new ClassPathResource("db/vendor/postgresql/V4__migrate_item_ids_to_uuid.sql")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(migration)
                .contains("'4' || substr(md5('vireo-template-item:' || id::text), 14, 3)")
                .contains("'8' || substr(md5('vireo-template-item:' || id::text), 18, 3)")
                .contains("jsonb_set(h.snapshot_previous::jsonb, '{id}', to_jsonb(h.entity_id), true)")
                .contains("jsonb_set(h.snapshot_current::jsonb, '{id}', to_jsonb(h.entity_id), true)")
                .contains("'{version}', '0'::jsonb, true");
    }
}
