import React from 'react';
import { useIngestionStore } from '@/store/ingestionStore';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface SourceSelectionStepProps {
  onNext: () => void;
}

const SourceSelectionStep: React.FC<SourceSelectionStepProps> = ({ onNext }) => {
  const { 
    sourceType, 
    targetType, 
    setSourceType, 
    setTargetType 
  } = useIngestionStore();

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">1. Select Source and Target</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source selection card */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-md font-medium text-gray-900 mb-3">Source</h3>
          
          <RadioGroup 
            value={sourceType} 
            onValueChange={(value) => setSourceType(value as 'clickhouse' | 'flatfile')}
            className="space-y-3"
          >
            <div className="space-y-3">
              <Label 
                htmlFor="source-clickhouse" 
                className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-primary-50 hover:border-primary-200 transition"
              >
                <RadioGroupItem 
                  value="clickhouse" 
                  id="source-clickhouse" 
                  className="h-4 w-4"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900">ClickHouse</span>
                  <span className="block text-sm text-gray-500">Database containing structured data</span>
                </span>
              </Label>
              
              <Label 
                htmlFor="source-flatfile" 
                className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-primary-50 hover:border-primary-200 transition"
              >
                <RadioGroupItem 
                  value="flatfile" 
                  id="source-flatfile" 
                  className="h-4 w-4"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900">Flat File</span>
                  <span className="block text-sm text-gray-500">CSV, TSV or other delimited file formats</span>
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Target selection card */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-md font-medium text-gray-900 mb-3">Target</h3>
          
          <RadioGroup 
            value={targetType} 
            onValueChange={(value) => setTargetType(value as 'clickhouse' | 'flatfile')}
            className="space-y-3"
          >
            <div className="space-y-3">
              <Label 
                htmlFor="target-flatfile" 
                className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-primary-50 hover:border-primary-200 transition"
              >
                <RadioGroupItem 
                  value="flatfile" 
                  id="target-flatfile" 
                  className="h-4 w-4"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900">Flat File</span>
                  <span className="block text-sm text-gray-500">Export data to CSV, TSV or other formats</span>
                </span>
              </Label>
              
              <Label 
                htmlFor="target-clickhouse" 
                className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-primary-50 hover:border-primary-200 transition"
              >
                <RadioGroupItem 
                  value="clickhouse" 
                  id="target-clickhouse" 
                  className="h-4 w-4"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900">ClickHouse</span>
                  <span className="block text-sm text-gray-500">Import data into a database table</span>
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext}>
          Next: Configure Connection
        </Button>
      </div>
    </div>
  );
};

export default SourceSelectionStep;
