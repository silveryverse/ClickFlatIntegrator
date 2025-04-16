import React, { useState } from 'react';
import { useIngestionStore } from '@/store/ingestionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface IngestionExecutionStepProps {
  onBack: () => void;
  onReset: () => void;
}

const IngestionExecutionStep: React.FC<IngestionExecutionStepProps> = ({ onBack, onReset }) => {
  const { 
    sourceType, 
    targetType,
    clickhouseConfig,
    fileConfig,
    selectedTables,
    selectedColumns,
    joinConfig
  } = useIngestionStore();

  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [recordsProcessed, setRecordsProcessed] = useState(0);
  const [progressStatus, setProgressStatus] = useState('Preparing...');
  const [outputConfig, setOutputConfig] = useState({
    // For flat file output
    outputFileName: '',
    outputDelimiter: 'comma',
    includeHeader: true,
    // For clickhouse output
    targetTable: '',
    tableAction: 'append',
    // General
    batchSize: '10000'
  });
  
  const { toast } = useToast();
  
  const isTargetClickhouse = targetType === 'clickhouse';
  const isSourceClickhouse = sourceType === 'clickhouse';
  const hasJoin = isSourceClickhouse && selectedTables.length > 1;

  const handleStartIngestion = async () => {
    // Validation
    if (isTargetClickhouse && !outputConfig.targetTable) {
      toast({
        title: "Missing target table",
        description: "Please specify a target table name",
        variant: "destructive",
      });
      return;
    }

    if (!isTargetClickhouse && !outputConfig.outputFileName) {
      toast({
        title: "Missing output file name",
        description: "Please specify an output file name",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setHasError(false);
    setProgress(0);
    setRecordsProcessed(0);
    setProgressStatus('Initializing...');

    try {
      // Setup polling for progress updates
      const progressInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/ingestion/progress');
          const data = await response.json();
          
          setProgress(data.progress);
          setRecordsProcessed(data.recordsProcessed);
          setProgressStatus(data.status);
          
          if (data.progress >= 100 || data.isCompleted) {
            clearInterval(progressInterval);
            if (data.isCompleted) {
              setIsRunning(false);
              setIsCompleted(true);
              setProgress(100);
            }
          }
        } catch (error) {
          // Silently fail - the main request will handle errors
        }
      }, 1000);

      // Start the ingestion process
      const requestData = {
        source: {
          type: sourceType,
          config: sourceType === 'clickhouse' ? clickhouseConfig : fileConfig
        },
        target: {
          type: targetType,
          config: targetType === 'clickhouse' ? {
            ...clickhouseConfig,
            targetTable: outputConfig.targetTable,
            tableAction: outputConfig.tableAction
          } : {
            fileName: outputConfig.outputFileName,
            delimiter: outputConfig.outputDelimiter,
            includeHeader: outputConfig.includeHeader
          }
        },
        tables: selectedTables,
        columns: selectedColumns,
        joinConfig: hasJoin ? joinConfig : undefined,
        batchSize: parseInt(outputConfig.batchSize, 10)
      };

      const response = await apiRequest('POST', '/api/ingestion/start', requestData);
      const data = await response.json();

      clearInterval(progressInterval);
      setIsRunning(false);
      setIsCompleted(true);
      setProgress(100);
      setRecordsProcessed(data.recordsProcessed);
    } catch (error) {
      setIsRunning(false);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  };

  const handleCancelIngestion = async () => {
    if (confirm('Are you sure you want to cancel the ingestion process?')) {
      try {
        await apiRequest('POST', '/api/ingestion/cancel', {});
        setIsRunning(false);
        setHasError(true);
        setErrorMessage('Ingestion cancelled by user.');
      } catch (error) {
        toast({
          title: "Failed to cancel",
          description: "Could not cancel the ingestion process",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">4. Ingestion Execution</h2>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        {/* Configuration Summary */}
        <h3 className="text-md font-medium text-gray-900 mb-3">Configuration Summary</h3>
        
        <div className="space-y-3 text-sm text-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="font-medium text-gray-900">Source:</span>
              <span className="ml-2">{sourceType === 'clickhouse' ? 'ClickHouse' : 'Flat File'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-900">Target:</span>
              <span className="ml-2">{targetType === 'clickhouse' ? 'ClickHouse' : 'Flat File'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-900">Selected Tables:</span>
              <span className="ml-2">{selectedTables.join(', ') || 'N/A'}</span>
            </div>
          </div>
          
          <div>
            <span className="font-medium text-gray-900">Selected Columns:</span>
            <span className="ml-2">{selectedColumns.join(', ')}</span>
          </div>
          
          {hasJoin && (
            <div>
              <span className="font-medium text-gray-900">Join Configuration:</span>
              <span className="ml-2">
                {joinConfig.joinType.toUpperCase()} JOIN on {joinConfig.joinCondition}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Output Configuration */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-900 mb-3">Output Configuration</h3>
        
        {!isTargetClickhouse && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="outputFileName">Output File Name</Label>
              <Input 
                type="text" 
                id="outputFileName" 
                value={outputConfig.outputFileName}
                onChange={(e) => setOutputConfig({ ...outputConfig, outputFileName: e.target.value })}
                placeholder="output_data.csv"
                disabled={isRunning || isCompleted}
              />
            </div>
            
            <div>
              <Label htmlFor="outputDelimiter">Output Delimiter</Label>
              <Select 
                value={outputConfig.outputDelimiter}
                onValueChange={(value) => setOutputConfig({ ...outputConfig, outputDelimiter: value })}
                disabled={isRunning || isCompleted}
              >
                <SelectTrigger id="outputDelimiter">
                  <SelectValue placeholder="Select delimiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comma">Comma (,)</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                  <SelectItem value="pipe">Pipe (|)</SelectItem>
                  <SelectItem value="semicolon">Semicolon (;)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeHeader" 
                checked={outputConfig.includeHeader}
                onCheckedChange={(checked) => setOutputConfig({ ...outputConfig, includeHeader: checked as boolean })}
                disabled={isRunning || isCompleted}
              />
              <Label htmlFor="includeHeader" className="text-sm text-gray-700">Include header row</Label>
            </div>
          </div>
        )}
        
        {isTargetClickhouse && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="targetTable">Target Table</Label>
              <Input 
                type="text" 
                id="targetTable" 
                value={outputConfig.targetTable}
                onChange={(e) => setOutputConfig({ ...outputConfig, targetTable: e.target.value })}
                placeholder="imported_data"
                disabled={isRunning || isCompleted}
              />
            </div>
            
            <div>
              <Label htmlFor="tableAction">If Table Exists</Label>
              <Select 
                value={outputConfig.tableAction}
                onValueChange={(value) => setOutputConfig({ ...outputConfig, tableAction: value })}
                disabled={isRunning || isCompleted}
              >
                <SelectTrigger id="tableAction">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">Append Data</SelectItem>
                  <SelectItem value="replace">Replace Table</SelectItem>
                  <SelectItem value="error">Return Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
      
      {/* Execution Controls */}
      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="batchSize">Batch Size</Label>
          <Select 
            value={outputConfig.batchSize}
            onValueChange={(value) => setOutputConfig({ ...outputConfig, batchSize: value })}
            disabled={isRunning || isCompleted}
          >
            <SelectTrigger id="batchSize" className="w-40">
              <SelectValue placeholder="Select batch size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">1,000 records</SelectItem>
              <SelectItem value="10000">10,000 records</SelectItem>
              <SelectItem value="50000">50,000 records</SelectItem>
              <SelectItem value="100000">100,000 records</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {isRunning && (
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-2">Ingestion Progress</h3>
            
            {/* Progress Bar */}
            <Progress value={progress} className="h-2.5 mb-2" />
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>{progressStatus}</span>
              <span>{progress}%</span>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Records Processed:</span>
                <span className="ml-1 text-sm text-gray-900">{recordsProcessed.toLocaleString()}</span>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelIngestion}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {isCompleted && !hasError && (
          <div>
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Ingestion Completed</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Successfully processed <span>{recordsProcessed.toLocaleString()}</span> records.</p>
                    <p className="mt-1">
                      {isTargetClickhouse 
                        ? `Data has been imported to ${outputConfig.targetTable} table`
                        : `Data has been exported to ${outputConfig.outputFileName}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {hasError && (
          <div>
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error During Ingestion</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={onBack}
          disabled={isRunning}
        >
          Back
        </Button>
        
        <div className="space-x-4">
          <Button 
            variant="outline" 
            onClick={onReset}
            disabled={isRunning}
          >
            Reset
          </Button>
          {!isRunning && !isCompleted && (
            <Button 
              onClick={handleStartIngestion}
            >
              Start Ingestion
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngestionExecutionStep;
