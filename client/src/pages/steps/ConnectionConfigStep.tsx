import React, { useState } from 'react';
import { useIngestionStore } from '@/store/ingestionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ConnectionConfigStepProps {
  onBack: () => void;
  onNext: () => void;
}

const ConnectionConfigStep: React.FC<ConnectionConfigStepProps> = ({ onBack, onNext }) => {
  const { 
    sourceType, 
    targetType,
    clickhouseConfig,
    fileConfig,
    setClickhouseConfig,
    setFileConfig
  } = useIngestionStore();

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isSourceClickhouse = sourceType === 'clickhouse';
  const isSourceFlatfile = sourceType === 'flatfile';

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      if (isSourceClickhouse) {
        await apiRequest('POST', '/api/test-clickhouse-connection', {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          database: clickhouseConfig.database,
          user: clickhouseConfig.user,
          jwtToken: clickhouseConfig.jwtToken
        });
        toast({
          title: "Connection successful",
          description: "Successfully connected to ClickHouse database",
          variant: "default",
        });
      } else {
        await apiRequest('POST', '/api/test-file-existence', {
          fileName: fileConfig.fileName
        });
        toast({
          title: "File check successful",
          description: "The file exists and is accessible",
          variant: "default",
        });
      }
    } catch (error) {
      let message = "Failed to connect";
      if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">2. Connection Configuration</h2>
      
      {/* ClickHouse Source Configuration */}
      {isSourceClickhouse && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">ClickHouse Connection Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="host">Host</Label>
              <Input 
                type="text" 
                id="host" 
                value={clickhouseConfig.host}
                onChange={(e) => setClickhouseConfig({ ...clickhouseConfig, host: e.target.value })}
                placeholder="localhost or IP address" 
              />
            </div>
            
            <div>
              <Label htmlFor="port">Port</Label>
              <Input 
                type="text" 
                id="port" 
                value={clickhouseConfig.port}
                onChange={(e) => setClickhouseConfig({ ...clickhouseConfig, port: e.target.value })}
                placeholder="9440 (https) or 9000 (http)" 
              />
            </div>
            
            <div>
              <Label htmlFor="database">Database</Label>
              <Input 
                type="text" 
                id="database" 
                value={clickhouseConfig.database}
                onChange={(e) => setClickhouseConfig({ ...clickhouseConfig, database: e.target.value })}
                placeholder="default" 
              />
            </div>
            
            <div>
              <Label htmlFor="user">User</Label>
              <Input 
                type="text" 
                id="user" 
                value={clickhouseConfig.user}
                onChange={(e) => setClickhouseConfig({ ...clickhouseConfig, user: e.target.value })}
                placeholder="default" 
              />
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor="jwtToken">JWT Token</Label>
              <Textarea 
                id="jwtToken" 
                rows={3} 
                value={clickhouseConfig.jwtToken}
                onChange={(e) => setClickhouseConfig({ ...clickhouseConfig, jwtToken: e.target.value })}
                placeholder="Enter JWT token for authentication" 
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Flat File Source Configuration */}
      {isSourceFlatfile && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">Flat File Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="fileName">File Path/Name</Label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Input 
                  type="text" 
                  id="fileName" 
                  value={fileConfig.fileName}
                  onChange={(e) => setFileConfig({ ...fileConfig, fileName: e.target.value })}
                  placeholder="/path/to/data.csv"
                  className="rounded-r-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none border-l-0"
                  onClick={() => {
                    toast({
                      title: "Sample data available",
                      description: "You can use sample data files in the 'sample_data' folder (e.g., sample_data/property_prices.csv)",
                      variant: "default",
                    });
                    setFileConfig({ ...fileConfig, fileName: 'sample_data/property_prices.csv' });
                  }}
                >
                  Browse
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="delimiter">Delimiter</Label>
              <Select 
                value={fileConfig.delimiter}
                onValueChange={(value) => setFileConfig({ ...fileConfig, delimiter: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delimiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comma">Comma (,)</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                  <SelectItem value="pipe">Pipe (|)</SelectItem>
                  <SelectItem value="semicolon">Semicolon (;)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {fileConfig.delimiter === 'other' && (
              <div>
                <Label htmlFor="otherDelimiter">Custom Delimiter</Label>
                <Input
                  type="text"
                  id="otherDelimiter"
                  value={fileConfig.otherDelimiter}
                  onChange={(e) => setFileConfig({ ...fileConfig, otherDelimiter: e.target.value })}
                  maxLength={1}
                  placeholder="Enter custom delimiter"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="hasHeader" 
                checked={fileConfig.hasHeader}
                onCheckedChange={(checked) => setFileConfig({ ...fileConfig, hasHeader: checked as boolean })} 
              />
              <Label htmlFor="hasHeader" className="text-sm text-gray-700">File has header row</Label>
            </div>
          </div>
        </div>
      )}
      
      {/* Connection Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={isLoading}
        >
          Test Connection
        </Button>
        
        <div className="flex space-x-4">
          <Button 
            variant="outline" 
            onClick={onBack} 
            disabled={isLoading}
          >
            Back
          </Button>
          <Button 
            onClick={onNext} 
            disabled={isLoading}
          >
            Next: Select Schema
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionConfigStep;
