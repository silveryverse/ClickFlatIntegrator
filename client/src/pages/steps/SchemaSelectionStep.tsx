import React, { useState, useEffect } from 'react';
import { useIngestionStore } from '@/store/ingestionStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import PreviewModal from '@/components/PreviewModal';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SchemaSelectionStepProps {
  onBack: () => void;
  onNext: () => void;
}

const SchemaSelectionStep: React.FC<SchemaSelectionStepProps> = ({ onBack, onNext }) => {
  const { 
    sourceType, 
    clickhouseConfig,
    fileConfig,
    selectedTables,
    selectedColumns,
    setSelectedTables,
    setSelectedColumns,
    joinConfig,
    setJoinConfig
  } = useIngestionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectAllTablesChecked, setSelectAllTablesChecked] = useState(false);
  const { toast } = useToast();

  const isClickhouseSource = sourceType === 'clickhouse';

  // Fetch tables from ClickHouse
  const { data: tables = [], isLoading: isLoadingTables, refetch: refetchTables } = useQuery({
    queryKey: ['/api/clickhouse/tables'],
    enabled: isClickhouseSource,
    queryFn: async ({ queryKey }) => {
      if (!isClickhouseSource) return [];
      
      const res = await fetch(queryKey[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clickhouseConfig),
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch tables');
      }
      
      return res.json();
    }
  });

  // Fetch columns based on selected tables
  const { data: columns = [], isLoading: isLoadingColumns } = useQuery({
    queryKey: ['/api/clickhouse/columns', selectedTables],
    enabled: isClickhouseSource && selectedTables.length > 0,
    queryFn: async ({ queryKey }) => {
      if (!isClickhouseSource || selectedTables.length === 0) return [];
      
      const res = await fetch(queryKey[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clickhouseConfig,
          tables: selectedTables
        }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch columns');
      }
      
      return res.json();
    }
  });

  // For flat file source, fetch columns
  const { data: fileColumns = [], isLoading: isLoadingFileColumns } = useQuery({
    queryKey: ['/api/file/columns'],
    enabled: sourceType === 'flatfile',
    queryFn: async ({ queryKey }) => {
      if (sourceType !== 'flatfile') return [];
      
      const res = await fetch(queryKey[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileConfig),
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch file columns');
      }
      
      return res.json();
    }
  });

  const allColumns = isClickhouseSource ? columns : fileColumns;

  const filteredTables = tables.filter(table => 
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTableSelect = (tableName: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedTables([...selectedTables, tableName]);
    } else {
      setSelectedTables(selectedTables.filter(name => name !== tableName));
    }
  };

  const handleSelectAllTables = (isChecked: boolean) => {
    setSelectAllTablesChecked(isChecked);
    if (isChecked) {
      setSelectedTables(tables.map(table => table.name));
    } else {
      setSelectedTables([]);
    }
  };

  const handleColumnSelect = (columnName: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedColumns([...selectedColumns, columnName]);
    } else {
      setSelectedColumns(selectedColumns.filter(name => name !== columnName));
    }
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(allColumns.map(column => column.name));
  };

  const handleClearAllColumns = () => {
    setSelectedColumns([]);
  };

  const handlePreviewData = async () => {
    if (selectedColumns.length === 0) {
      toast({
        title: "No columns selected",
        description: "Please select at least one column to preview",
        variant: "destructive",
      });
      return;
    }

    setIsPreviewModalOpen(true);
  };

  // Update selections when tables or columns change
  useEffect(() => {
    setSelectAllTablesChecked(selectedTables.length === tables.length && tables.length > 0);
  }, [selectedTables, tables]);

  // Show join configuration only if multiple tables are selected
  const showJoinConfig = isClickhouseSource && selectedTables.length > 1;

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">3. Schema Selection</h2>
      
      {/* ClickHouse Table Selection - Only show for ClickHouse source */}
      {isClickhouseSource && (
        <div className="mb-6">
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-md font-medium text-gray-900">Available Tables</h3>
            <div className="flex items-center space-x-2">
              <Input 
                type="text" 
                id="tableSearch" 
                placeholder="Search tables..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => refetchTables()}
                disabled={isLoadingTables}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        id="selectAllTables" 
                        checked={selectAllTablesChecked}
                        onCheckedChange={handleSelectAllTables}
                      />
                    </TableHead>
                    <TableHead>Table Name</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Rows (approx.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTables ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        Loading tables...
                      </TableCell>
                    </TableRow>
                  ) : filteredTables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        No tables found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTables.map((table) => (
                      <TableRow key={table.name} className="hover:bg-gray-50 cursor-pointer">
                        <TableCell>
                          <Checkbox 
                            checked={selectedTables.includes(table.name)}
                            onCheckedChange={(checked) => handleTableSelect(table.name, checked as boolean)}
                            className="table-select"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{table.name}</TableCell>
                        <TableCell>{table.engine}</TableCell>
                        <TableCell>{table.rows_formatted}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          {/* Join Configuration (Bonus Feature) */}
          {showJoinConfig && (
            <div className="mt-4">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-blue-700">
                      Multiple tables selected. Configure join relationship below.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="joinType">Join Type</Label>
                  <Select 
                    value={joinConfig.joinType} 
                    onValueChange={(value) => setJoinConfig({ ...joinConfig, joinType: value })}
                  >
                    <SelectTrigger id="joinType">
                      <SelectValue placeholder="Select join type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inner">INNER JOIN</SelectItem>
                      <SelectItem value="left">LEFT JOIN</SelectItem>
                      <SelectItem value="right">RIGHT JOIN</SelectItem>
                      <SelectItem value="full">FULL JOIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="joinCondition">Join Condition</Label>
                  <Input 
                    type="text" 
                    id="joinCondition" 
                    value={joinConfig.joinCondition}
                    onChange={(e) => setJoinConfig({ ...joinConfig, joinCondition: e.target.value })}
                    placeholder={`${selectedTables[0]}.id = ${selectedTables[1]}.${selectedTables[0]}_id`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Column Selection */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-md font-medium text-gray-900">Select Columns</h3>
          <div className="flex items-center space-x-2">
            <Button variant="link" size="sm" onClick={handleSelectAllColumns}>
              Select All
            </Button>
            <span className="text-gray-300">|</span>
            <Button variant="link" size="sm" onClick={handleClearAllColumns}>
              Clear All
            </Button>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-md">
          <div className="max-h-80 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {isLoadingColumns || isLoadingFileColumns ? (
              <div className="col-span-full text-center py-4">Loading columns...</div>
            ) : allColumns.length === 0 ? (
              <div className="col-span-full text-center py-4">
                {isClickhouseSource 
                  ? "Please select a table to view columns" 
                  : "No columns found in file"}
              </div>
            ) : (
              allColumns.map((column) => (
                <Label 
                  key={column.name} 
                  className="flex items-start space-x-2 p-1"
                >
                  <Checkbox 
                    checked={selectedColumns.includes(column.name)}
                    onCheckedChange={(checked) => handleColumnSelect(column.name, checked as boolean)}
                    className="h-4 w-4 mt-1"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">{column.name}</span>
                    <span className="block text-xs text-gray-500">{column.type}</span>
                  </div>
                </Label>
              ))
            )}
          </div>
        </div>
        
        {/* Preview Button */}
        <div className="mt-3">
          <Button 
            variant="outline" 
            onClick={handlePreviewData}
            disabled={isLoadingColumns || isLoadingFileColumns || selectedColumns.length === 0}
          >
            Preview Data (First 100 Records)
          </Button>
        </div>
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex items-center justify-end space-x-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={selectedColumns.length === 0}
        >
          Next: Run Ingestion
        </Button>
      </div>

      {/* Preview Modal */}
      <PreviewModal 
        isOpen={isPreviewModalOpen} 
        onClose={() => setIsPreviewModalOpen(false)}
        columns={selectedColumns}
      />
    </div>
  );
};

export default SchemaSelectionStep;
