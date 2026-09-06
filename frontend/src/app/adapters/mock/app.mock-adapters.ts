import type {
  QueryEngineApi,
  QueryEngineEntityDefinition,
  QueryEngineEntitySummary,
  QueryEngineRelationOption,
} from "@vireocodedev/query";
import { configureAppAdapters, type AppAdapters } from "../app.adapters";
import {
  configureOfflineShowcaseTransport,
  installOfflineItemAdapter,
  type AppOfflineCurrentUser,
  type AppOfflineShowcaseTransport,
} from "../app-offline.adapter";
import type { AppAuthApi } from "@/app/data/network/api/app-auth.api";
import { AppAuthFailureError } from "@/app/data/network/models/AppAuthFailure";
import { AuthUser } from "@/app/data/network/models/AuthUser";
import type { HistoryApi } from "@/features/history/public";
import { Item, ItemCreateRequest, ItemPatchRequest, type ItemApi } from "@/features/item/public";
import type { HistoryEntityKind, HistoryRecord, HistorySnapshot, HistoryTimestamp } from "@vireocodedev/history";
import type { PageableParams, PageableResponse } from "@vireocodedev/infrastructure";
import { z } from "zod";

const MOCK_AUTH_STORAGE_KEY = "starter-template:mock-auth";
const MOCK_ITEMS_STORAGE_KEY = "starter-template:mock-items";
const MOCK_USER_ID = "44444444-4444-4444-8444-444444444444";

function readSessionValue<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Mock persistence is a convenience; the in-memory contract remains usable.
  }
}

const initialItems: Item[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    version: 0,
    name: "Prepare quarterly review",
    description: "Mock-backed frontend workflow",
    quantity: 3,
    status: "ACTIVE",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    version: 0,
    name: "Validate field operations",
    description: "Runs without a backend service",
    quantity: 8,
    status: "DRAFT",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    version: 0,
    name: "Archive completed request",
    description: "Replace this adapter with the company API",
    quantity: 1,
    status: "ARCHIVED",
  },
];

class MockAuthApi implements AppAuthApi {
  private user: AuthUser | null = readSessionValue(MOCK_AUTH_STORAGE_KEY, AuthUser);

  async login(username: string, password: string) {
    if (username !== "demo" || password !== "demo123") {
      throw new AppAuthFailureError({ kind: "invalid-credentials" });
    }
    this.user = { username, role: "SUPERADMIN" };
    writeSessionValue(MOCK_AUTH_STORAGE_KEY, this.user);
    return { username, message: "Authenticated by the frontend mock adapter." };
  }

  async logout(): Promise<void> {
    this.user = null;
    try {
      sessionStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    } catch {
      // Best effort only.
    }
  }

  async me(): Promise<AuthUser> {
    if (!this.user) throw new AppAuthFailureError({ kind: "unauthenticated" });
    return this.user;
  }
}

class MockItemApi implements ItemApi {
  private items = readSessionValue(MOCK_ITEMS_STORAGE_KEY, z.array(Item)) ?? initialItems.map(item => ({ ...item }));

  private persist(): void {
    writeSessionValue(MOCK_ITEMS_STORAGE_KEY, this.items);
  }

  async search(pageable: PageableParams, filters: Parameters<ItemApi["search"]>[1]): Promise<PageableResponse<Item>> {
    const search = filters.searchText.trim().toLocaleLowerCase();
    const filtered = this.items.filter(item =>
      search ? `${item.name} ${item.description} ${item.status}`.toLocaleLowerCase().includes(search) : true,
    );
    const sorted = [...filtered].sort((left, right) => {
      const leftValue = left[pageable.sortBy as keyof Item];
      const rightValue = right[pageable.sortBy as keyof Item];
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
      return pageable.sortDirection === "desc" ? -comparison : comparison;
    });
    const start = pageable.page * pageable.rowsPerPage;
    return {
      content: sorted.slice(start, start + pageable.rowsPerPage),
      number: pageable.page,
      size: pageable.rowsPerPage,
      totalElements: sorted.length,
      totalPages: Math.ceil(sorted.length / pageable.rowsPerPage),
    };
  }

  async create(value: Item) {
    if (this.items.some(item => item.id === value.id)) throw new Error(`Mock item ${value.id} already exists.`);
    const created = { ...value, version: 0 };
    this.items.push(created);
    this.persist();
    return { persistence: "SAVED" as const, value: { ...created } };
  }

  async update(id: string, value: Item) {
    const index = this.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error(`Mock item ${id} does not exist.`);
    if (this.items[index].version !== value.version) throw new Error(`Mock item ${id} has changed.`);
    const updated = { ...value, id, version: this.items[index].version + 1 };
    this.items[index] = updated;
    this.persist();
    return { persistence: "SAVED" as const, value: { ...updated } };
  }

  async delete(id: string, version: number) {
    const item = this.items.find(candidate => candidate.id === id);
    if (!item) throw new Error(`Mock item ${id} does not exist.`);
    if (item.version !== version) throw new Error(`Mock item ${id} has changed.`);
    this.items = this.items.filter(item => item.id !== id);
    this.persist();
    return { persistence: "SAVED" as const, value: undefined };
  }
}

class MockHistoryApi implements HistoryApi {
  async find<
    TSnapshot extends HistorySnapshot,
    TEntityKind extends HistoryEntityKind,
    TTimestamp extends HistoryTimestamp,
  >(
    _schema: z.ZodType<HistoryRecord<TSnapshot, TEntityKind, TTimestamp>>,
    _entity: TEntityKind,
    _entityId: string | number,
    _signal?: AbortSignal,
  ): Promise<HistoryRecord<TSnapshot, TEntityKind, TTimestamp>[]> {
    void _schema;
    void _entity;
    void _entityId;
    void _signal;
    return [];
  }
}

const itemDefinition: QueryEngineEntityDefinition = {
  key: "ITEM",
  title: "Items",
  fields: [
    {
      path: "name",
      label: "Name",
      type: "STRING",
      enumType: null,
      enumValues: [],
      operators: ["CONTAINS", "EQUALS", "STARTS_WITH"],
      relation: false,
      relationEntityKey: null,
      relationMode: "CHILD",
      multiple: false,
      relationSelectionLabelFields: [],
      expandable: false,
      maxDepth: 0,
      children: [],
    },
    {
      path: "status",
      label: "Status",
      type: "ENUM",
      enumType: "ItemStatus",
      enumValues: ["DRAFT", "ACTIVE", "ARCHIVED"],
      operators: ["EQUALS", "NOT_EQUALS", "IN"],
      relation: false,
      relationEntityKey: null,
      relationMode: "CHILD",
      multiple: false,
      relationSelectionLabelFields: [],
      expandable: false,
      maxDepth: 0,
      children: [],
    },
  ],
};

class MockQueryEngineApi implements QueryEngineApi {
  async listEntities(): Promise<QueryEngineEntitySummary[]> {
    return [{ key: itemDefinition.key, filterableFieldCount: itemDefinition.fields.length }];
  }

  async describeEntity(entityKey: string): Promise<QueryEngineEntityDefinition> {
    if (entityKey !== itemDefinition.key) return { key: entityKey, title: entityKey, fields: [] };
    return itemDefinition;
  }

  async listRelationOptions(): Promise<QueryEngineRelationOption[]> {
    return [];
  }
}

export function createMockAppAdapters(): AppAdapters {
  return {
    auth: new MockAuthApi(),
    history: new MockHistoryApi(),
    items: new MockItemApi(),
    query: new MockQueryEngineApi(),
  };
}

export function installMockAppAdapters(): void {
  const adapters = createMockAppAdapters();
  configureAppAdapters({ auth: adapters.auth, history: adapters.history, query: adapters.query });
  const items = adapters.items as MockItemApi;
  configureOfflineShowcaseTransport(createMockOfflineShowcaseTransport(items));
  installOfflineItemAdapter(items);
}

function currentMockUser(): AppOfflineCurrentUser {
  const user = readSessionValue(MOCK_AUTH_STORAGE_KEY, AuthUser);
  if (!user) throw new AppAuthFailureError({ kind: "unauthenticated" });
  return { id: MOCK_USER_ID, username: user.username, role: user.role, validatedAt: Date.now() };
}

function createMockOfflineShowcaseTransport(items: MockItemApi): AppOfflineShowcaseTransport {
  return {
    currentUser: async () => currentMockUser(),
    searchItems: (pageable, filters) => items.search(pageable, filters),
    replay: async commands => {
      const results: Array<{
        commandId: string;
        success: boolean;
        status: number;
        error: string | null;
        reason: "APPLIED" | "REJECTED";
      }> = [];
      for (const command of commands) {
        try {
          if (command.method === "POST" && command.url === "/api/items") {
            const create = ItemCreateRequest.parse(command.body);
            await items.create(Item.parse({ ...create, version: 0 }));
            results.push({ commandId: command.commandId, success: true, status: 201, error: null, reason: "APPLIED" });
            continue;
          }
          const itemId = command.url.match(/\/api\/items\/([^/]+)$/u)?.[1];
          if (!itemId) throw new Error("Invalid Item replay URL.");
          if (command.method === "PATCH") {
            const patch = ItemPatchRequest.parse(command.body);
            const current = (
              await items.search(
                { page: 0, rowsPerPage: Number.MAX_SAFE_INTEGER, sortBy: "name", sortDirection: "asc" },
                { searchText: "", queryFilters: null },
              )
            ).content.find(item => item.id === itemId);
            if (!current) throw new Error(`Mock item ${itemId} does not exist.`);
            await items.update(itemId, Item.parse({ ...current, ...patch, id: itemId }));
            results.push({ commandId: command.commandId, success: true, status: 200, error: null, reason: "APPLIED" });
            continue;
          }
          if (command.method === "DELETE") {
            const body = z.object({ version: z.number().int().nonnegative() }).parse(command.body);
            await items.delete(itemId, body.version);
            results.push({ commandId: command.commandId, success: true, status: 204, error: null, reason: "APPLIED" });
            continue;
          }
          throw new Error("Unsupported Item replay command.");
        } catch (error) {
          results.push({
            commandId: command.commandId,
            success: false,
            status: 409,
            error: error instanceof Error ? error.message : "Mock replay failed.",
            reason: "REJECTED",
          });
        }
      }
      return { results };
    },
  };
}
