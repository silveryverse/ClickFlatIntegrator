import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Ingestion state table for tracking progress
export const ingestionStates = pgTable("ingestion_states", {
  id: serial("id").primaryKey(),
  progress: integer("progress").notNull().default(0),
  recordsProcessed: integer("records_processed").notNull().default(0),
  status: text("status").notNull().default(""),
  isCompleted: boolean("is_completed").notNull().default(false),
  source: json("source").notNull(),
  target: json("target").notNull(),
  tables: json("tables"),
  columns: json("columns").notNull(),
  joinConfig: json("join_config"),
  batchSize: integer("batch_size").notNull().default(10000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIngestionStateSchema = createInsertSchema(ingestionStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIngestionState = z.infer<typeof insertIngestionStateSchema>;
export type IngestionState = typeof ingestionStates.$inferSelect;
