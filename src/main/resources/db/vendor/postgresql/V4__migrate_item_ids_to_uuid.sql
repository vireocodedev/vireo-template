-- Item is the Template's admitted offline reference entity. Preserve every
-- persisted field while replacing generated numeric IDs with permanent RFC 4122
-- version-4 UUIDs. The retained crosswalk also makes historical Item records
-- auditable after the table rebuild.
CREATE TABLE item_id_migration_map (
    legacy_id BIGINT PRIMARY KEY,
    item_id UUID NOT NULL UNIQUE
);

INSERT INTO item_id_migration_map (legacy_id, item_id)
SELECT id,
       (
           substr(md5('vireo-template-item:' || id::text), 1, 8) || '-' ||
           substr(md5('vireo-template-item:' || id::text), 9, 4) || '-' ||
           '4' || substr(md5('vireo-template-item:' || id::text), 14, 3) || '-' ||
           '8' || substr(md5('vireo-template-item:' || id::text), 18, 3) || '-' ||
           substr(md5('vireo-template-item:' || id::text), 21, 12)
       )::uuid
FROM item;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM history h
        LEFT JOIN item_id_migration_map c ON c.legacy_id = h.entity_id::bigint
        WHERE h.entity = 'ITEM'
          AND c.legacy_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot migrate Item IDs: one or more ITEM history rows have no matching Item.';
    END IF;
END
$$;

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
SET entity_id = c.item_id::text
FROM item_id_migration_map c
WHERE h.entity = 'ITEM'
  AND c.legacy_id = h.entity_id::bigint;

-- Preserve retained snapshots as valid current ItemDTO-shaped JSON. History
-- created before this migration contains numeric ids and no optimistic version.
UPDATE history h
SET snapshot_previous = CASE
        WHEN h.snapshot_previous IS NULL OR btrim(h.snapshot_previous) = '{}' THEN h.snapshot_previous
        ELSE jsonb_set(
            jsonb_set(h.snapshot_previous::jsonb, '{id}', to_jsonb(h.entity_id), true),
            '{version}', '0'::jsonb, true
        )::text
    END,
    snapshot_current = CASE
        WHEN h.snapshot_current IS NULL OR btrim(h.snapshot_current) = '{}' THEN h.snapshot_current
        ELSE jsonb_set(
            jsonb_set(h.snapshot_current::jsonb, '{id}', to_jsonb(h.entity_id), true),
            '{version}', '0'::jsonb, true
        )::text
    END
WHERE h.entity = 'ITEM';

DROP TABLE item_legacy_v4;

CREATE INDEX ix_item_name ON item (name);
CREATE INDEX ix_item_status ON item (status);
