import { timestamp } from "drizzle-orm/mysql-core";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const todosTable = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  todo: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  upadatedAt: timestamp("updated_at").$onUpdate(() => new Date()), // This is a function that returns a new Date object
});
