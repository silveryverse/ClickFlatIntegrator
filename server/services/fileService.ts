import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { parse as csvParse } from 'csv-parse';
import { ClickHouseClient } from '@clickhouse/client';

const pipelineAsync = promisify(pipeline);
const readFileAsync = promisify(fs.readFile);
const accessAsync = promisify(fs.access);

export class FileService {
  async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await accessAsync(filePath, fs.constants.F_OK | fs.constants.R_OK);
      return true;
    } catch (error) {
      throw new Error(`File not accessible: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getColumns(config: any): Promise<any[]> {
    const { fileName, delimiter, otherDelimiter, hasHeader } = config;
    
    // Check if file exists
    await this.checkFileExists(fileName);
    
    // Determine the delimiter character
    let delimiterChar = ',';
    switch (delimiter) {
      case 'tab': delimiterChar = '\t'; break;
      case 'pipe': delimiterChar = '|'; break;
      case 'semicolon': delimiterChar = ';'; break;
      case 'other': delimiterChar = otherDelimiter || ','; break;
    }
    
    try {
      // Read the first few lines to detect columns
      const fileStream = createReadStream(fileName);
      const parser = csvParse({
        delimiter: delimiterChar,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
        from_line: 1,
        to_line: 10 // Read 10 lines for sampling
      });
      
      const records: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const parserStream = fileStream.pipe(parser);
        
        parserStream.on('data', (record) => {
          records.push(record);
        });
        
        parserStream.on('end', () => {
          resolve();
        });
        
        parserStream.on('error', (err) => {
          reject(err);
        });
      });
      
      // If no header, create column names
      if (!hasHeader && records.length > 0) {
        return Object.keys(records[0]).map((key, index) => ({
          name: `column${index + 1}`,
          type: this.inferType(records.map(r => r[key])),
          sample: records[0][key]
        }));
      }
      
      // With header, infer types from values
      if (records.length > 0) {
        return Object.keys(records[0]).map(key => ({
          name: key,
          type: this.inferType(records.map(r => r[key])),
          sample: records[0][key]
        }));
      }
      
      return [];
    } catch (error) {
      throw new Error(`Failed to get columns: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async previewData(config: any, columns: string[], limit: number): Promise<any[]> {
    const { fileName, delimiter, otherDelimiter, hasHeader } = config;
    
    // Check if file exists
    await this.checkFileExists(fileName);
    
    // Determine the delimiter character
    let delimiterChar = ',';
    switch (delimiter) {
      case 'tab': delimiterChar = '\t'; break;
      case 'pipe': delimiterChar = '|'; break;
      case 'semicolon': delimiterChar = ';'; break;
      case 'other': delimiterChar = otherDelimiter || ','; break;
    }
    
    try {
      // Read file with specified columns
      const fileStream = createReadStream(fileName);
      const parser = csvParse({
        delimiter: delimiterChar,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
        from_line: 1,
        to_line: limit + (hasHeader ? 1 : 0) // Add 1 for header if present
      });
      
      const records: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const parserStream = fileStream.pipe(parser);
        
        parserStream.on('data', (record) => {
          // Filter to only include requested columns
          if (columns.length > 0) {
            const filteredRecord: any = {};
            columns.forEach(column => {
              filteredRecord[column] = record[column];
            });
            records.push(filteredRecord);
          } else {
            records.push(record);
          }
          
          // Stop after limit records
          if (records.length >= limit) {
            parserStream.destroy();
            resolve();
          }
        });
        
        parserStream.on('end', () => {
          resolve();
        });
        
        parserStream.on('error', (err) => {
          reject(err);
        });
      });
      
      return records;
    } catch (error) {
      throw new Error(`Failed to preview data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async importToClickHouse(
    sourceConfig: any, 
    targetConfig: any, 
    columns: string[], 
    batchSize: number,
    progressCallback: (progress: { progress: number, recordsProcessed: number, status: string }) => void
  ): Promise<{ success: boolean, recordsProcessed: number, message: string }> {
    // Extract configs
    const { fileName, delimiter, otherDelimiter, hasHeader } = sourceConfig;
    const { host, port, database, user, jwtToken, targetTable, tableAction } = targetConfig;
    
    // Check if file exists
    await this.checkFileExists(fileName);
    
    // Determine the delimiter character
    let delimiterChar = ',';
    switch (delimiter) {
      case 'tab': delimiterChar = '\t'; break;
      case 'pipe': delimiterChar = '|'; break;
      case 'semicolon': delimiterChar = ';'; break;
      case 'other': delimiterChar = otherDelimiter || ','; break;
    }
    
    // Connect to ClickHouse
    let auth: any = { username: user };
    if (jwtToken) {
      auth = { type: 'jwt', token: jwtToken };
    }
    
    const client = new ClickHouseClient({
      host: `${host}:${port}`,
      database,
      auth
    });
    
    let recordsProcessed = 0;
    
    try {
      progressCallback({ 
        progress: 10, 
        recordsProcessed: 0, 
        status: 'Analyzing data...' 
      });
      
      // Get column types for creating the table
      const fileColumns = await this.getColumns(sourceConfig);
      const columnTypes = new Map<string, string>();
      
      fileColumns.forEach(col => {
        columnTypes.set(col.name, this.mapTypeToClickHouse(col.type));
      });
      
      // Filter columns based on user selection
      const selectedColumns = fileColumns.filter(col => columns.includes(col.name));
      
      // Check if table exists
      const tableExists = await this.checkTableExists(client, targetTable);
      
      // Handle table action based on user selection
      if (tableExists) {
        if (tableAction === 'error') {
          throw new Error(`Table '${targetTable}' already exists and 'error' action was specified`);
        } else if (tableAction === 'replace') {
          await client.query({
            query: `DROP TABLE IF EXISTS \`${targetTable}\``
          }).exec();
          
          // Create new table
          await this.createTable(client, targetTable, selectedColumns, columnTypes);
        }
        // If 'append', we'll use the existing table
      } else {
        // Create new table
        await this.createTable(client, targetTable, selectedColumns, columnTypes);
      }
      
      progressCallback({ 
        progress: 20, 
        recordsProcessed: 0, 
        status: 'Starting data import...' 
      });
      
      // Read and import data in batches
      const fileStream = createReadStream(fileName);
      const parser = csvParse({
        delimiter: delimiterChar,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
        from_line: hasHeader ? 2 : 1 // Skip header if present
      });
      
      let batch: any[] = [];
      let lastProgressUpdate = Date.now();
      
      await new Promise<void>((resolve, reject) => {
        const parserStream = fileStream.pipe(parser);
        
        parserStream.on('data', async (record) => {
          // Filter to only include requested columns
          const filteredRecord: any = {};
          columns.forEach(column => {
            filteredRecord[column] = record[column];
          });
          
          batch.push(filteredRecord);
          recordsProcessed++;
          
          // Process in batches
          if (batch.length >= batchSize) {
            // Pause the stream while processing the batch
            parserStream.pause();
            
            try {
              await this.insertBatch(client, targetTable, batch);
              batch = [];
              
              // Update progress
              const now = Date.now();
              if (now - lastProgressUpdate > 1000) {
                const progress = Math.min(20 + Math.floor(recordsProcessed / 1000), 95);
                progressCallback({ 
                  progress, 
                  recordsProcessed, 
                  status: 'Importing data...' 
                });
                lastProgressUpdate = now;
              }
              
              // Resume the stream
              parserStream.resume();
            } catch (error) {
              parserStream.destroy(error instanceof Error ? error : new Error(String(error)));
            }
          }
        });
        
        parserStream.on('end', async () => {
          // Insert any remaining records
          if (batch.length > 0) {
            try {
              await this.insertBatch(client, targetTable, batch);
            } catch (error) {
              return reject(error);
            }
          }
          resolve();
        });
        
        parserStream.on('error', (err) => {
          reject(err);
        });
      });
      
      progressCallback({ 
        progress: 100, 
        recordsProcessed, 
        status: 'Import completed' 
      });
      
      return {
        success: true,
        recordsProcessed,
        message: `Successfully imported ${recordsProcessed} records to table ${targetTable}`
      };
    } catch (error) {
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.close();
    }
  }

  // Helper methods
  private inferType(values: any[]): string {
    // Check if all values are numbers
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonEmptyValues.length === 0) return 'String';
    
    const allNumbers = nonEmptyValues.every(v => !isNaN(Number(v)));
    if (allNumbers) {
      const allIntegers = nonEmptyValues.every(v => Number.isInteger(Number(v)));
      return allIntegers ? 'Integer' : 'Float';
    }
    
    // Check if values look like dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
    const allDates = nonEmptyValues.every(v => dateRegex.test(String(v)));
    if (allDates) return 'Date';
    
    // Default to string
    return 'String';
  }

  private mapTypeToClickHouse(type: string): string {
    switch (type) {
      case 'Integer': return 'Int64';
      case 'Float': return 'Float64';
      case 'Date': return 'Date';
      default: return 'String';
    }
  }

  private async checkTableExists(client: ClickHouseClient, tableName: string): Promise<boolean> {
    const result = await client.query({
      query: `
        SELECT name FROM system.tables 
        WHERE database = currentDatabase() AND name = '${tableName}'
      `
    }).exec();
    
    return result.length > 0;
  }

  private async createTable(
    client: ClickHouseClient, 
    tableName: string, 
    columns: any[], 
    columnTypes: Map<string, string>
  ): Promise<void> {
    const columnDefinitions = columns.map(col => 
      `\`${col.name}\` ${columnTypes.get(col.name) || 'String'}`
    ).join(', ');
    
    await client.query({
      query: `
        CREATE TABLE IF NOT EXISTS \`${tableName}\` (
          ${columnDefinitions}
        ) ENGINE = MergeTree()
        ORDER BY tuple()
      `
    }).exec();
  }

  private async insertBatch(client: ClickHouseClient, tableName: string, records: any[]): Promise<void> {
    if (records.length === 0) return;
    
    const columns = Object.keys(records[0]);
    const columnList = columns.map(c => `\`${c}\``).join(', ');
    
    // Insert in batch using JSONEachRow format
    await client.insert({
      table: tableName,
      values: records,
      format: 'JSONEachRow'
    });
  }
}
