import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ClickHouseService } from "./services/clickhouseService";
import { FileService } from "./services/fileService";
import { z } from "zod";
import { IngestionState } from "../shared/schema";

// Zod schemas for validation
const clickhouseConnectionSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.string().min(1, "Port is required"),
  database: z.string().min(1, "Database is required"),
  user: z.string().min(1, "User is required"),
  jwtToken: z.string().optional(),
});

const fileConnectionSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  delimiter: z.string().min(1, "Delimiter is required"),
  otherDelimiter: z.string().optional(),
  hasHeader: z.boolean().default(true),
});

// We are using the database storage to track the ingestion state

export async function registerRoutes(app: Express): Promise<Server> {
  const clickhouseService = new ClickHouseService();
  const fileService = new FileService();

  // Test ClickHouse connection
  app.post('/api/test-clickhouse-connection', async (req, res) => {
    try {
      const config = clickhouseConnectionSchema.parse(req.body);
      await clickhouseService.testConnection(config);
      res.json({ success: true, message: 'Connection successful' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      res.status(400).json({ success: false, message });
    }
  });

  // Test file existence
  app.post('/api/test-file-existence', async (req, res) => {
    try {
      const { fileName } = fileConnectionSchema.parse(req.body);
      await fileService.checkFileExists(fileName);
      res.json({ success: true, message: 'File accessible' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File not accessible';
      res.status(400).json({ success: false, message });
    }
  });

  // Get tables from ClickHouse
  app.post('/api/clickhouse/tables', async (req, res) => {
    try {
      const config = clickhouseConnectionSchema.parse(req.body);
      const tables = await clickhouseService.getTables(config);
      res.json(tables);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tables';
      res.status(400).json({ success: false, message });
    }
  });

  // Get columns from ClickHouse tables
  app.post('/api/clickhouse/columns', async (req, res) => {
    try {
      const config = clickhouseConnectionSchema.parse(req.body);
      const { tables } = req.body;
      
      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ success: false, message: 'No tables specified' });
      }
      
      const columns = await clickhouseService.getColumns(config, tables);
      res.json(columns);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch columns';
      res.status(400).json({ success: false, message });
    }
  });

  // Get columns from flat file
  app.post('/api/file/columns', async (req, res) => {
    try {
      const config = fileConnectionSchema.parse(req.body);
      const columns = await fileService.getColumns(config);
      res.json(columns);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch file columns';
      res.status(400).json({ success: false, message });
    }
  });

  // Preview data from ClickHouse
  app.post('/api/clickhouse/preview', async (req, res) => {
    try {
      const config = clickhouseConnectionSchema.parse(req.body);
      const { tables, columns, joinConfig, limit = 100 } = req.body;
      
      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ success: false, message: 'No tables specified' });
      }
      
      if (!Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({ success: false, message: 'No columns specified' });
      }
      
      const data = await clickhouseService.previewData(config, tables, columns, joinConfig, limit);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to preview data';
      res.status(400).json({ success: false, message });
    }
  });

  // Preview data from flat file
  app.post('/api/file/preview', async (req, res) => {
    try {
      const config = fileConnectionSchema.parse(req.body);
      const { columns, limit = 100 } = req.body;
      
      if (!Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({ success: false, message: 'No columns specified' });
      }
      
      const data = await fileService.previewData(config, columns, limit);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to preview file data';
      res.status(400).json({ success: false, message });
    }
  });

  // Start ingestion process
  app.post('/api/ingestion/start', async (req, res) => {
    try {
      // Validate the request
      const {
        source,
        target,
        tables,
        columns,
        joinConfig,
        batchSize
      } = req.body;

      if (!source || !target || !columns || columns.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters' 
        });
      }

      // Create a new ingestion state
      const newIngestion = {
        progress: 0,
        recordsProcessed: 0,
        status: 'Initializing...',
        isCompleted: false,
        source,
        target,
        tables,
        columns,
        joinConfig,
        batchSize
      };

      // Store the ingestion state in the database
      const savedState = await storage.saveIngestionState(newIngestion);

      // Start the ingestion in the background
      setTimeout(async () => {
        try {
          let result;
          
          // Update status
          const currentState = await storage.getIngestionState();
          if (currentState) {
            currentState.status = 'Fetching data...';
            currentState.progress = 10;
            await storage.updateIngestionProgress(currentState);
          }
          
          if (source.type === 'clickhouse' && target.type === 'flatfile') {
            // ClickHouse to Flat File
            result = await clickhouseService.exportToFlatFile(
              source.config,
              target.config,
              tables,
              columns,
              joinConfig,
              batchSize,
              async (progress) => {
                const state = await storage.getIngestionState();
                if (state) {
                  state.progress = progress.progress;
                  state.recordsProcessed = progress.recordsProcessed;
                  state.status = progress.status;
                  await storage.updateIngestionProgress(state);
                }
              }
            );
          } else if (source.type === 'flatfile' && target.type === 'clickhouse') {
            // Flat File to ClickHouse
            result = await fileService.importToClickHouse(
              source.config,
              target.config,
              columns,
              batchSize,
              async (progress) => {
                const state = await storage.getIngestionState();
                if (state) {
                  state.progress = progress.progress;
                  state.recordsProcessed = progress.recordsProcessed;
                  state.status = progress.status;
                  await storage.updateIngestionProgress(state);
                }
              }
            );
          } else {
            throw new Error('Unsupported source/target combination');
          }
          
          // Mark as completed
          const finalState = await storage.getIngestionState();
          if (finalState) {
            finalState.isCompleted = true;
            finalState.progress = 100;
            finalState.status = 'Completed';
            finalState.recordsProcessed = result.recordsProcessed;
            await storage.updateIngestionProgress(finalState);
          }
        } catch (error) {
          // Handle errors in the background process
          console.error('Ingestion error:', error);
          const errorState = await storage.getIngestionState();
          if (errorState) {
            errorState.isCompleted = true;
            errorState.status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            await storage.updateIngestionProgress(errorState);
          }
        }
      }, 0);

      // Immediately return success to the client
      return res.json({ 
        success: true, 
        message: 'Ingestion process started successfully' 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start ingestion';
      return res.status(500).json({ success: false, message });
    }
  });

  // Get ingestion progress
  app.get('/api/ingestion/progress', async (req, res) => {
    try {
      const state = await storage.getIngestionState();
      if (!state) {
        return res.json({
          progress: 0,
          recordsProcessed: 0,
          status: 'No ingestion in progress',
          isCompleted: false
        });
      }
      
      return res.json({
        progress: state.progress,
        recordsProcessed: state.recordsProcessed,
        status: state.status,
        isCompleted: state.isCompleted
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get progress';
      return res.status(500).json({ success: false, message });
    }
  });

  // Cancel ingestion
  app.post('/api/ingestion/cancel', async (req, res) => {
    try {
      const currentState = await storage.getIngestionState();
      if (currentState) {
        currentState.isCompleted = true;
        currentState.status = 'Cancelled by user';
        await storage.updateIngestionProgress(currentState);
      }
      
      return res.json({ 
        success: true, 
        message: 'Ingestion cancelled' 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel ingestion';
      return res.status(500).json({ success: false, message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
