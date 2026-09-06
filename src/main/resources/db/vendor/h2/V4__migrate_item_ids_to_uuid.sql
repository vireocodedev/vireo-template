-- Item is the Template's admitted offline reference entity. Preserve every
-- persisted field while replacing generated numeric IDs with permanent RFC 4122
-- version-4 UUIDs. The retained crosswalk also makes historical Item records
-- auditable after the table rebuild.
CREATE TABLE item_id_migration_map (
    legacy_id BIGINT PRIMARY KEY,
    item_id UUID NOT NULL UNIQUE
);

INSERT INTO item_id_migration_map (legacy_id, item_id)
SELECT id, CAST(
    SUBSTRING(RAWTOHEX(HASH('MD5', STRINGTOUTF8('vireo-template-item:' || CAST(id AS VARCHAR)))), 1, 8) || '-' ||
    SUBSTRING(RAWTOHEX(HASH('MD5', STRINGTOUTF8('vireo-template-item:' || CAST(id AS VARCHAR)))), 9, 4) || '-4' ||
    SUBSTRING(RAWTOHEX(HASH('MD5', STRINGTOUTF8('vireo-template-item:' || CAST(id AS VARCHAR)))), 14, 3) || '-8' ||
    SUBSTRING(RAWTOHEX(HASH('MD5', STRINGTOUTF8('vireo-template-item:' || CAST(id AS VARCHAR)))), 18, 3) || '-' ||
    SUBSTRING(RAWTOHEX(HASH('MD5', STRINGTOUTF8('vireo-template-item:' || CAST(id AS VARCHAR)))), 21, 12)
    AS UUID)
FROM item;

-- A history row without a corresponding legacy Item must stop this migration;
-- silently losing the link would corrupt the audit trail.
CREATE TABLE item_history_migration_guard (
    valid BOOLEAN NOT NULL,
    CONSTRAINT ck_item_history_migration_guard CHECK (valid)
);

INSERT INTO item_history_migration_guard (valid)
SELECT NOT EXISTS (
    SELECT 1
    FROM history h
    LEFT JOIN item_id_migration_map c ON c.legacy_id = CAST(h.entity_id AS BIGINT)
    WHERE h.entity = 'ITEM'
      AND c.legacy_id IS NULL
);

DROP TABLE item_history_migration_guard;

ALTER TABLE item RENAME TO item_legacy_v4;

CREATE TABLE item (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    modified_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    modified_by VARCHAR(255),
    keywords VARCHAR(2048),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_item_v4_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_item_v4_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT ck_item_v4_quantity_nonnegative CHECK (quantity >= 0)
);

INSERT INTO item (
    id, version, name, description, quantity, status, created_at, modified_at,
    created_by, modified_by, keywords, deleted
)
SELECT c.item_id, 0, legacy.name, legacy.description, legacy.quantity, legacy.status,
       legacy.created_at, legacy.modified_at, legacy.created_by, legacy.modified_by,
       legacy.keywords, legacy.deleted
FROM item_legacy_v4 legacy
JOIN item_id_migration_map c ON c.legacy_id = legacy.id;

UPDATE history h
SET entity_id = CAST((
    SELECT c.item_id
    FROM item_id_migration_map c
    WHERE c.legacy_id = CAST(h.entity_id AS BIGINT)
) AS VARCHAR(36))
WHERE h.entity = 'ITEM';

-- Preserve retained snapshots as valid current ItemDTO-shaped JSON. History
-- created before this migration contains numeric ids and no optimistic version.
UPDATE history h
SET snapshot_previous = CASE
        WHEN h.snapshot_previous IS NULL OR TRIM(h.snapshot_previous) = '{}' THEN h.snapshot_previous
        ELSE REGEXP_REPLACE(
                REGEXP_REPLACE(
                    h.snapshot_previous,
                    '"id"[[:space:]]*:[[:space:]]*[0-9]+',
                    '"id":"' || h.entity_id || '"'
                ),
                '}[[:space:]]*$',
                CASE WHEN REGEXP_LIKE(h.snapshot_previous, '"version"[[:space:]]*:')
                    THEN '}' ELSE ',"version":0}' END
             )
    END,
    snapshot_current = CASE
        WHEN h.snapshot_current IS NULL OR TRIM(h.snapshot_current) = '{}' THEN h.snapshot_current
        ELSE REGEXP_REPLACE(
                REGEXP_REPLACE(
                    h.snapshot_current,
                    '"id"[[:space:]]*:[[:space:]]*[0-9]+',
                    '"id":"' || h.entity_id || '"'
                ),
                '}[[:space:]]*$',
                CASE WHEN REGEXP_LIKE(h.snapshot_current, '"version"[[:space:]]*:')
                    THEN '}' ELSE ',"version":0}' END
             )
    END
WHERE h.entity = 'ITEM';

DROP TABLE item_legacy_v4;

CREATE INDEX ix_item_name ON item (name);
CREATE INDEX ix_item_status ON item (status);
