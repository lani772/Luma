# Database

## Stack

| Component | Technology |
|---|---|
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation layer | drizzle-zod + Zod v4 |
| Connection | `pg` (node-postgres) Pool |

---

## Connection

The database connection is managed by `lib/db/src/index.ts`.
It exports two singletons used throughout the API server:

```typescript
import { db, pool } from "@workspace/db";

// db  — Drizzle query builder (use this for all queries)
// pool — raw pg.Pool (use only for advanced cases like transactions)
```

The connection string is read from `DATABASE_URL` (injected automatically by Replit).
The server **throws at startup** if `DATABASE_URL` is not set — there is no silent fallback.

---

## Schema Location

All table definitions live in:

```
lib/db/src/schema/index.ts
```

This is the **single source of truth** for the database schema.
Add one `export * from "./tablename"` per table, with each table in its own file.

---

## Defining a Table

```typescript
// lib/db/src/schema/devices.ts

import { pgTable, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("devices", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull(),
  type:       text("type").notNull(),
  mac:        text("mac").notNull().unique(),
  room:       text("room"),
  floor:      text("floor"),
  firmware:   text("firmware").notNull().default("0.0.0"),
  status:     text("status").notNull().default("offline"),
  mqttTopic:  text("mqtt_topic"),
  state:      jsonb("state").notNull().default({}),
  config:     jsonb("config").notNull().default({}),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

// Zod schemas — auto-generated from the table definition
export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ createdAt: true, updatedAt: true });
export const selectDeviceSchema = createSelectSchema(devicesTable);

// TypeScript types
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device       = typeof devicesTable.$inferSelect;
```

Then register it in the barrel file:

```typescript
// lib/db/src/schema/index.ts
export * from "./devices";
```

---

## Pushing Schema Changes

In development, push schema changes directly to the database:

```bash
pnpm --filter @workspace/db run push
```

This runs `drizzle-kit push` — it introspects your schema files, diffs against the live DB, and applies DDL statements.

> **Do not write custom migration scripts.**
> Replit handles production schema migration automatically at publish time.
> See `replit.md` for the publish flow.

---

## Querying with Drizzle

### Select all

```typescript
import { db } from "@workspace/db";
import { devicesTable } from "@workspace/db";

const devices = await db.select().from(devicesTable);
```

### Select with filter

```typescript
import { eq, and, like } from "drizzle-orm";

const lamp = await db
  .select()
  .from(devicesTable)
  .where(eq(devicesTable.id, "ESP32_Lamp_01"))
  .limit(1);
```

### Insert

```typescript
const newDevice: InsertDevice = {
  id:       "ESP32_Fan_01",
  name:     "Bedroom Fan",
  type:     "fan",
  mac:      "B4:CF:12:23:34:46",
  firmware: "1.0.0",
  status:   "offline",
};

await db.insert(devicesTable).values(newDevice);
```

### Update

```typescript
await db
  .update(devicesTable)
  .set({ status: "online", firmware: "2.1.0" })
  .where(eq(devicesTable.id, "ESP32_Lamp_01"));
```

### Delete

```typescript
await db
  .delete(devicesTable)
  .where(eq(devicesTable.id, "ESP32_Fan_01"));
```

### Insert or update (upsert)

```typescript
await db
  .insert(devicesTable)
  .values(device)
  .onConflictDoUpdate({
    target: devicesTable.id,
    set: { status: "online", updatedAt: new Date() },
  });
```

---

## Using Zod Schemas in Routes

The auto-generated Zod schemas validate request bodies without duplication:

```typescript
import { insertDeviceSchema } from "@workspace/db";

router.post("/devices", async (req, res) => {
  const parsed = insertDeviceSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  await db.insert(devicesTable).values(parsed.data);
  res.json({ ok: true });
});
```

---

## Transactions

Use `db.transaction()` for operations that must succeed or fail together:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(devicesTable).values(device);
  await tx.insert(firmwareLogsTable).values({
    deviceId: device.id,
    version:  device.firmware,
    action:   "registered",
  });
});
```

---

## Common Column Patterns

```typescript
import {
  pgTable, text, boolean, integer, real,
  timestamp, jsonb, uuid, serial
} from "drizzle-orm/pg-core";

// Primary keys
id: uuid("id").primaryKey().defaultRandom()     // UUID auto-generated
id: serial("id").primaryKey()                    // auto-increment integer
id: text("id").primaryKey()                      // manual string ID

// Timestamps
createdAt: timestamp("created_at").notNull().defaultNow(),
updatedAt: timestamp("updated_at").notNull().defaultNow(),

// JSON blobs (device state, config, metadata)
state:  jsonb("state").notNull().default({}),
config: jsonb("config").notNull().default({}),

// Nullable foreign key
homeId: text("home_id").references(() => homesTable.id),
```

---

## Planned Tables

The following tables are not yet created but are implied by the engine architecture.
Add them as features are built:

| Table | Purpose |
|---|---|
| `devices` | Persistent device registry (currently in-memory in Device Engine) |
| `firmware_jobs` | OTA/USB job history (currently in-memory in Firmware engines) |
| `mqtt_messages` | MQTT message log for debugging |
| `activity_logs` | Device command history |
| `homes` | Multi-home support |
| `users` | User accounts (for future auth integration) |
| `microcontrollers` | ESP32 unit registry |

---

## Checking the Database

```bash
# Check if database is provisioned
pnpm exec -- node -e "require('@workspace/db').pool.query('SELECT 1').then(() => console.log('OK'))"

# List tables
pnpm --filter @workspace/db run push  # also shows diff
```
