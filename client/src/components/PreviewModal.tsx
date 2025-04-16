import React, { useState } from 'react';
import { useIngestionStore } from '@/store/ingestionStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: string[];
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, columns }) => {
  const { 
    sourceType, 
    clickhouseConfig, 
    fileConfig, 
    selectedTables,
    joinConfig 
  } = useIngestionStore();

  // Fetch preview data
  const { data: previewData = [], isLoading } = useQuery({
    queryKey: ['/api/preview-data', sourceType, selectedTables.join(','), columns.join(',')],
    enabled: isOpen && columns.length > 0,
    queryFn: async ({ queryKey }) => {
      const endpoint = sourceType === 'clickhouse' 
        ? '/api/clickhouse/preview' 
        : '/api/file/preview';

      const requestBody = sourceType === 'clickhouse'
        ? {
            ...clickhouseConfig,
            tables: selectedTables,
            columns,
            joinConfig: selectedTables.length > 1 ? joinConfig : undefined,
            limit: 100
          }
        : {
            ...fileConfig,
            columns,
            limit: 100
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch preview data');
      }

      return res.json();
    }
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-w-[800px]">
        <DialogHeader className="flex justify-between items-center mb-4">
          <DialogTitle>Data Preview (First 100 Records)</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </DialogHeader>
        
        <div className="bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-4">
                    Loading preview data...
                  </TableCell>
                </TableRow>
              ) : previewData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-4">
                    No data available for preview
                  </TableCell>
                </TableRow>
              ) : (
                previewData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((column) => (
                      <TableCell key={`${rowIndex}-${column}`} className="py-2">
                        {String(row[column] !== undefined ? row[column] : '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewModal;
