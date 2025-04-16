import { ClickHouseClient } from '@clickhouse/client';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { createInterface } from 'readline';

const pipelineAsync = promisify(pipeline);

export class ClickHouseService {
  private getClient(config: any) {
    const { host, port, database, user, jwtToken } = config;
    
    let auth: any = { username: user };
    
    // Use JWT token if provided
    if (jwtToken) {
      auth = { type: 'jwt', token: jwtToken };
    }
    
    return new ClickHouseClient({
      host: `${host}:${port}`,
      database,
      auth
    });
  }

  async testConnection(config: any): Promise<boolean> {
    const client = this.getClient(config);
    try {
      // Simple query to test connection
      await client.query({ query: 'SELECT 1' }).exec();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to ClickHouse: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  async getTables(config: any): Promise<any[]> {
    const client = this.getClient(config);
    try {
      const result = await client.query({
        query: `
          SELECT 
            name,
            engine,
            total_rows as rows,
            formatReadableSize(total_bytes) as size
          FROM system.tables
          WHERE database = '${config.database}'
          ORDER BY name
        `
      }).exec();

      return result.map((table: any) => ({
        name: table.name,
        engine: table.engine,
        rows: table.rows,
        rows_formatted: this.formatNumber(table.rows),
        size: table.size
      }));
    } catch (error) {
      throw new Error(`Failed to get tables: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  async getColumns(config: any, tables: string[]): Promise<any[]> {
    const client = this.getClient(config);
    try {
      const columnsPromises = tables.map(table => 
        client.query({
          query: `
            SELECT 
              name,
              type,
              default_kind as default_type,
              default_expression
            FROM system.columns
            WHERE database = '${config.database}' AND table = '${table}'
          `
        }).exec()
      );

      const results = await Promise.all(columnsPromises);
      
      // Flatten and remove duplicates by column name
      const uniqueColumns = new Map();
      results.flat().forEach((column: any) => {
        uniqueColumns.set(column.name, column);
      });

      return Array.from(uniqueColumns.values());
    } catch (error) {
      throw new Error(`Failed to get columns: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  async previewData(config: any, tables: string[], columns: string[], joinConfig: any | undefined, limit: number): Promise<any[]> {
    const client = this.getClient(config);
    try {
      let query;
      
      if (tables.length === 1) {
        // Simple select
        query = `
          SELECT ${columns.map(c => `\`${c}\``).join(', ')}
          FROM \`${config.database}\`.\`${tables[0]}\`
          LIMIT ${limit}
        `;
      } else if (tables.length > 1 && joinConfig) {
        // Implement JOIN query based on joinConfig
        const { joinType, joinCondition } = joinConfig;
        
        const primaryTable = tables[0];
        const secondaryTables = tables.slice(1);
        
        query = `
          SELECT ${columns.map(c => `\`${c}\``).join(', ')}
          FROM \`${config.database}\`.\`${primaryTable}\`
        `;
        
        secondaryTables.forEach((table, index) => {
          query += `
            ${joinType.toUpperCase()} JOIN \`${config.database}\`.\`${table}\`
            ON ${joinCondition}
          `;
        });
        
        query += `LIMIT ${limit}`;
      } else {
        throw new Error('Invalid table or join configuration');
      }

      return await client.query({ query }).exec();
    } catch (error) {
      throw new Error(`Failed to preview data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  async exportToFlatFile(
    sourceConfig: any, 
    targetConfig: any, 
    tables: string[], 
    columns: string[], 
    joinConfig: any | undefined,
    batchSize: number,
    progressCallback: (progress: { progress: number, recordsProcessed: number, status: string }) => void
  ): Promise<{ success: boolean, recordsProcessed: number, message: string }> {
    const client = this.getClient(sourceConfig);
    let recordsProcessed = 0;
    
    try {
      // Determine the delimiter character
      let delimiter = ',';
      switch (targetConfig.delimiter) {
        case 'tab': delimiter = '\t'; break;
        case 'pipe': delimiter = '|'; break;
        case 'semicolon': delimiter = ';'; break;
        case 'other': delimiter = targetConfig.otherDelimiter || ','; break;
      }

      // Create write stream for the output file
      const outputStream = createWriteStream(targetConfig.fileName);
      
      // Write header if needed
      if (targetConfig.includeHeader) {
        outputStream.write(columns.join(delimiter) + '\n');
      }

      // Construct query based on tables and join configuration
      let query;
      
      progressCallback({ 
        progress: 15, 
        recordsProcessed: 0, 
        status: 'Building query...' 
      });
      
      if (tables.length === 1) {
        // Simple select
        query = `
          SELECT ${columns.map(c => `\`${c}\``).join(', ')}
          FROM \`${sourceConfig.database}\`.\`${tables[0]}\`
          FORMAT JSONEachRow
        `;
      } else if (tables.length > 1 && joinConfig) {
        // Implement JOIN query based on joinConfig
        const { joinType, joinCondition } = joinConfig;
        
        const primaryTable = tables[0];
        const secondaryTables = tables.slice(1);
        
        query = `
          SELECT ${columns.map(c => `\`${c}\``).join(', ')}
          FROM \`${sourceConfig.database}\`.\`${primaryTable}\`
        `;
        
        secondaryTables.forEach(table => {
          query += `
            ${joinType.toUpperCase()} JOIN \`${sourceConfig.database}\`.\`${table}\`
            ON ${joinCondition}
          `;
        });
        
        query += `FORMAT JSONEachRow`;
      } else {
        throw new Error('Invalid table or join configuration');
      }

      progressCallback({ 
        progress: 20, 
        recordsProcessed: 0, 
        status: 'Starting data export...' 
      });

      // Execute the query and handle the response as a stream
      const queryStream = await client.query({ query }).stream();
      
      let buffer: string[] = [];
      let lastProgressUpdate = Date.now();
      
      for await (const row of queryStream) {
        const rowData = Object.values(row).map(value => {
          // Handle quoting and escaping for CSV-like formats
          if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(delimiter);
        
        buffer.push(rowData);
        recordsProcessed++;
        
        // Flush the buffer periodically
        if (buffer.length >= batchSize) {
          outputStream.write(buffer.join('\n') + '\n');
          buffer = [];
        }
        
        // Update progress every second
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const progress = Math.min(20 + Math.floor(recordsProcessed / 1000), 95);
          progressCallback({ 
            progress, 
            recordsProcessed, 
            status: 'Exporting data...' 
          });
          lastProgressUpdate = now;
        }
      }
      
      // Write any remaining data
      if (buffer.length > 0) {
        outputStream.write(buffer.join('\n') + '\n');
      }
      
      // Close the output stream
      outputStream.end();
      
      progressCallback({ 
        progress: 100, 
        recordsProcessed, 
        status: 'Export completed' 
      });
      
      return {
        success: true,
        recordsProcessed,
        message: `Successfully exported ${recordsProcessed} records to ${targetConfig.fileName}`
      };
    } catch (error) {
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  // Helper method to format large numbers
  private formatNumber(num: number): string {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + 'B';
    } else if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}
