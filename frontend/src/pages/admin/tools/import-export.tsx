/**
 * Import/Export Tools Page
 * Admin tools for importing and exporting entities
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { exportService } from '@/services/admin.export';
import { importService } from '@/services/admin.import';
import { Download, Upload, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ExportEntity {
  type: 'world' | 'ruleset' | 'npc' | 'npc_pack' | 'entry';
  id: string;
  name: string;
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  warnings: string[];
  job_id?: string;
}

export default function ImportExportPage() {
  const [exportType, setExportType] = useState<'world' | 'ruleset' | 'npc' | 'npc_pack' | 'entry'>('ruleset');
  const [exportEntity, setExportEntity] = useState<ExportEntity | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeAssociations: true,
    includeMetadata: true
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importOptions, setImportOptions] = useState({
    upsertBy: 'slug' as 'slug' | 'name',
    skipValidation: false
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!exportEntity) {
      setError('Please select an entity to export');
      return;
    }

    try {
      setExporting(true);
      setError(null);

      let result;
      switch (exportType) {
        case 'world':
          result = await exportService.exportWorld(exportEntity.id, exportOptions);
          break;
        case 'ruleset':
          result = await exportService.exportRuleset(exportEntity.id, exportOptions);
          break;
        case 'npc':
          result = await exportService.exportNPC(exportEntity.id, exportOptions);
          break;
        case 'npc_pack':
          result = await exportService.exportNPCPack(exportEntity.id, exportOptions);
          break;
        case 'entry':
          result = await exportService.exportEntry(exportEntity.id, exportOptions);
          break;
        default:
          throw new Error('Invalid export type');
      }

      if (result.success) {
        const filename = `${exportEntity.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        exportService.downloadAsFile(result.data, filename);
        setSuccess(`Exported ${exportEntity.name} successfully`);
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportData(null);
      setImportResult(null);
      setError(null);
    }
  };

  const handleValidateImport = async () => {
    if (!importFile) {
      setError('Please select a file to import');
      return;
    }

    try {
      setError(null);
      const text = await importFile.text();
      const data = JSON.parse(text);
      setImportData(data);

      const validation = await importService.validateImport(data);
      if (validation.valid) {
        setSuccess('Import file is valid');
      } else {
        setError(`Validation failed: ${validation.diagnostics.map(d => d.message).join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse import file');
    }
  };

  const handleApplyImport = async () => {
    if (!importData) {
      setError('Please validate the import file first');
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const result = await importService.applyImport(importData, importOptions);
      setImportResult(result);

      if (result.success) {
        setSuccess(`Import completed: ${result.created} created, ${result.updated} updated`);
      } else {
        setError(`Import failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import/Export Tools</h1>
        <p className="text-gray-600 mt-1">
          Import and export entities as JSON files
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Entity</CardTitle>
              <CardDescription>
                Export a single entity as a JSON file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Entity Type</label>
                  <Select value={exportType} onValueChange={(value: any) => setExportType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="world">World</SelectItem>
                      <SelectItem value="ruleset">Ruleset</SelectItem>
                      <SelectItem value="npc">NPC</SelectItem>
                      <SelectItem value="npc_pack">NPC Pack</SelectItem>
                      <SelectItem value="entry">Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Entity</label>
                  <Select value={exportEntity?.id || ''} onValueChange={(value) => {
                    // This would be populated from actual entity data
                    setExportEntity({ type: exportType, id: value, name: 'Selected Entity' });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sample Entity 1</SelectItem>
                      <SelectItem value="2">Sample Entity 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Export Options</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeAssociations}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeAssociations: e.target.checked
                      }))}
                    />
                    <span className="text-sm">Include associations</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeMetadata}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeMetadata: e.target.checked
                      }))}
                    />
                    <span className="text-sm">Include metadata</span>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleExport}
                disabled={!exportEntity || exporting}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Entity</CardTitle>
              <CardDescription>
                Import entities from a JSON file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Import File</label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {importFile ? importFile.name : 'Select JSON File'}
                  </Button>
                </div>
              </div>

              {importFile && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Upsert Strategy</label>
                      <Select
                        value={importOptions.upsertBy}
                        onValueChange={(value: 'slug' | 'name') => setImportOptions(prev => ({
                          ...prev,
                          upsertBy: value
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="slug">By Slug</SelectItem>
                          <SelectItem value="name">By Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Validation</label>
                      <Select
                        value={importOptions.skipValidation ? 'skip' : 'validate'}
                        onValueChange={(value) => setImportOptions(prev => ({
                          ...prev,
                          skipValidation: value === 'skip'
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="validate">Validate</SelectItem>
                          <SelectItem value="skip">Skip Validation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleValidateImport}
                      variant="outline"
                      className="flex-1"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Validate
                    </Button>
                    <Button
                      onClick={handleApplyImport}
                      disabled={!importData || importing}
                      className="flex-1"
                    >
                      {importing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Apply Import
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Import Result</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <Badge className="ml-2" variant="outline">
                        {importResult.created}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600">Updated:</span>
                      <Badge className="ml-2" variant="outline">
                        {importResult.updated}
                      </Badge>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                      <ul className="text-sm text-red-600 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importResult.warnings.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-yellow-600 mb-2">Warnings:</h4>
                      <ul className="text-sm text-yellow-600 space-y-1">
                        {importResult.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
