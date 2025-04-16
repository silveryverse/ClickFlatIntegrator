import { 
  ingestionStates, 
  type IngestionState, 
  type InsertIngestionState,
  users, 
  type User, 
  type InsertUser
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Ingestion states
  saveIngestionState(state: IngestionState): Promise<IngestionState>;
  getIngestionState(): Promise<IngestionState | null>;
  updateIngestionProgress(state: IngestionState): Promise<void>;
}

import { db } from "./db";
import { eq } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Ingestion state methods
  async saveIngestionState(state: IngestionState): Promise<IngestionState> {
    // First, clean up old ingestion states (we only keep one active)
    await db.delete(ingestionStates);
    
    // Then insert the new state
    const [savedState] = await db
      .insert(ingestionStates)
      .values({
        progress: state.progress || 0,
        recordsProcessed: state.recordsProcessed || 0,
        status: state.status || "",
        isCompleted: state.isCompleted || false,
        source: state.source,
        target: state.target,
        tables: state.tables,
        columns: state.columns,
        joinConfig: state.joinConfig,
        batchSize: state.batchSize || 10000
      })
      .returning();
    
    return savedState;
  }

  async getIngestionState(): Promise<IngestionState | null> {
    const [state] = await db
      .select()
      .from(ingestionStates)
      .orderBy(ingestionStates.id, "desc")
      .limit(1);
    
    return state || null;
  }

  async updateIngestionProgress(state: IngestionState): Promise<void> {
    if (!state.id) {
      const currentState = await this.getIngestionState();
      if (currentState) {
        state.id = currentState.id;
      } else {
        // If no current state, save a new one
        await this.saveIngestionState(state);
        return;
      }
    }
    
    await db
      .update(ingestionStates)
      .set({
        progress: state.progress,
        recordsProcessed: state.recordsProcessed,
        status: state.status,
        isCompleted: state.isCompleted,
        updatedAt: new Date()
      })
      .where(eq(ingestionStates.id, state.id));
  }
}

export const storage = new DatabaseStorage();
