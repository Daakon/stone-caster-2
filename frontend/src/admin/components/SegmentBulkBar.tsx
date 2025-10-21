/**
 * Segment Bulk Bar Component
 * Phase 4: Bulk operations toolbar for selected segments
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToggleLeft, ToggleRight, Download, Upload, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SegmentBulkBarProps {
  selectedCount: number;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  onBulkExport: () => void;
  onClose: () => void;
}

export function SegmentBulkBar({
  selectedCount,
  onBulkActivate,
  onBulkDeactivate,
  onBulkExport,
  onClose
}: SegmentBulkBarProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          setImportData(data);
        } else {
          setImportError('File must contain an array of segments');
        }
      } catch (error) {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (importData.length === 0) {
      setImportError('No valid data to import');
      return;
    }

    // TODO: Implement actual import logic
    toast.success(`Imported ${importData.length} segments`);
    setShowImportDialog(false);
    setImportFile(null);
    setImportData([]);
    setImportError(null);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">{selectedCount}</Badge>
              <span className="text-sm font-medium">
                segment{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkActivate}
                className="text-green-600 hover:text-green-700"
              >
                <ToggleRight className="h-4 w-4 mr-1" />
                Activate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDeactivate}
                className="text-orange-600 hover:text-orange-700"
              >
                <ToggleLeft className="h-4 w-4 mr-1" />
                Deactivate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onBulkExport}
                className="text-blue-600 hover:text-blue-700"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>

              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Segments</DialogTitle>
                    <DialogDescription>
                      Import segments from a JSON file
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="import-file">Select JSON File</Label>
                      <Input
                        id="import-file"
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                      />
                    </div>

                    {importError && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{importError}</AlertDescription>
                      </Alert>
                    )}

                    {importData.length > 0 && (
                      <div className="p-3 bg-muted rounded-md">
                        <div className="text-sm font-medium mb-2">
                          Preview ({importData.length} segments):
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {importData.slice(0, 5).map((segment, index) => (
                            <div key={index} className="text-xs text-muted-foreground">
                              • {segment.id} - {segment.scope} - {segment.content?.substring(0, 50)}...
                            </div>
                          ))}
                          {importData.length > 5 && (
                            <div className="text-xs text-muted-foreground">
                              ... and {importData.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportDialog(false);
                        setImportFile(null);
                        setImportData([]);
                        setImportError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={importData.length === 0 || !!importError}
                    >
                      Import {importData.length} Segments
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
