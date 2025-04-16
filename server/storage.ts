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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private ingestionState: IngestionState | null = null;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Ingestion state methods
  async saveIngestionState(state: IngestionState): Promise<IngestionState> {
    this.ingestionState = state;
    return state;
  }

  async getIngestionState(): Promise<IngestionState | null> {
    return this.ingestionState;
  }

  async updateIngestionProgress(state: IngestionState): Promise<void> {
    this.ingestionState = state;
  }
}

export const storage = new MemStorage();
