import { create } from 'zustand';

interface ClickHouseConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  jwtToken: string;
}

interface FileConfig {
  fileName: string;
  delimiter: string;
  otherDelimiter: string;
  hasHeader: boolean;
}

interface JoinConfig {
  joinType: string;
  joinCondition: string;
}

interface IngestionState {
  // Source and target types
  sourceType: 'clickhouse' | 'flatfile';
  targetType: 'clickhouse' | 'flatfile';
  
  // Connection configurations
  clickhouseConfig: ClickHouseConfig;
  fileConfig: FileConfig;
  
  // Schema selection
  selectedTables: string[];
  selectedColumns: string[];
  joinConfig: JoinConfig;
  
  // Actions
  setSourceType: (type: 'clickhouse' | 'flatfile') => void;
  setTargetType: (type: 'clickhouse' | 'flatfile') => void;
  setClickhouseConfig: (config: ClickHouseConfig) => void;
  setFileConfig: (config: FileConfig) => void;
  setSelectedTables: (tables: string[]) => void;
  setSelectedColumns: (columns: string[]) => void;
  setJoinConfig: (config: JoinConfig) => void;
  resetStore: () => void;
}

const initialState = {
  sourceType: 'clickhouse' as const,
  targetType: 'flatfile' as const,
  
  clickhouseConfig: {
    host: 'localhost',
    port: '8123',
    database: 'default',
    user: 'default',
    jwtToken: '',
  },
  
  fileConfig: {
    fileName: '',
    delimiter: 'comma',
    otherDelimiter: '',
    hasHeader: true,
  },
  
  selectedTables: [],
  selectedColumns: [],
  
  joinConfig: {
    joinType: 'inner',
    joinCondition: '',
  },
};

export const useIngestionStore = create<IngestionState>((set) => ({
  ...initialState,
  
  setSourceType: (type) => set({ sourceType: type }),
  setTargetType: (type) => set({ targetType: type }),
  setClickhouseConfig: (config) => set({ clickhouseConfig: config }),
  setFileConfig: (config) => set({ fileConfig: config }),
  setSelectedTables: (tables) => set({ selectedTables: tables }),
  setSelectedColumns: (columns) => set({ selectedColumns: columns }),
  setJoinConfig: (config) => set({ joinConfig: config }),
  resetStore: () => set(initialState),
}));
