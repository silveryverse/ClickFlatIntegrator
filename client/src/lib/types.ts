// Database types
export interface ClickHouseTable {
  name: string;
  engine: string;
  rows: number;
  rows_formatted: string;
}

export interface ClickHouseColumn {
  name: string;
  type: string;
  default_type: string;
  default_expression: string;
}

export interface FileColumn {
  name: string;
  type: string;
  sample: string;
}

// Ingestion types
export interface IngestionProgress {
  progress: number;
  recordsProcessed: number;
  status: string;
  isCompleted: boolean;
}

export interface IngestionResult {
  success: boolean;
  recordsProcessed: number;
  message: string;
}

// API request types
export interface ClickHouseConnectionConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  jwtToken: string;
}

export interface FileConnectionConfig {
  fileName: string;
  delimiter: string;
  otherDelimiter?: string;
  hasHeader: boolean;
}

export interface JoinConfig {
  joinType: string;
  joinCondition: string;
}

export interface IngestionRequest {
  source: {
    type: 'clickhouse' | 'flatfile';
    config: ClickHouseConnectionConfig | FileConnectionConfig;
  };
  target: {
    type: 'clickhouse' | 'flatfile';
    config: (ClickHouseConnectionConfig & {
      targetTable: string;
      tableAction: string;
    }) | (FileConnectionConfig & {
      fileName: string;
      delimiter: string;
      includeHeader: boolean;
    });
  };
  tables?: string[];
  columns: string[];
  joinConfig?: JoinConfig;
  batchSize: number;
}
