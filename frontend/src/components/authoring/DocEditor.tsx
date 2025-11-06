/**
 * Phase 20: Document Editor
 * JSON/YAML Monaco editor with schema-aware autocomplete and diagnostics
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  json_pointer: string;
  code?: string;
  suggestion?: string;
}

interface DocEditorProps {
  document: {
    id: string;
    name: string;
    type: string;
    content: string;
    format: 'json' | 'yaml';
    diagnostics: Diagnostic[];
  };
  onSave: (content: string, format: 'json' | 'yaml') => void;
  onValidate: () => void;
  onPreview: () => void;
  onPlaytest: () => void;
  onDiff: () => void;
  onPublish: () => void;
}

export function DocEditor({
  document,
  onSave,
  onValidate,
  onPreview,
  onPlaytest,
  onDiff,
  onPublish,
}: DocEditorProps) {
  const [content, setContent] = useState(document.content);
  const [format, setFormat] = useState(document.format);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(document.content);
    setFormat(document.format);
    setIsDirty(false);
  }, [document.id]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };

  const handleFormatChange = (newFormat: 'json' | 'yaml') => {
    setFormat(newFormat);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content, format);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getDiagnosticIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getDiagnosticColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const errorCount = document.diagnostics.filter(d => d.level === 'error').length;
  const warningCount = document.diagnostics.filter(d => d.level === 'warning').length;
  const infoCount = document.diagnostics.filter(d => d.level === 'info').length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{document.name}</h2>
            <Badge variant="outline">{document.type}</Badge>
            {isDirty && <Badge variant="secondary">Modified</Badge>}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onValidate}
              disabled={isSaving}
            >
              Validate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onPreview}
              disabled={isSaving}
            >
              Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onPlaytest}
              disabled={isSaving}
            >
              Playtest
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDiff}
              disabled={isSaving}
            >
              Diff
            </Button>
            <Button
              size="sm"
              onClick={onPublish}
              disabled={isSaving || errorCount > 0}
            >
              Publish
            </Button>
          </div>
        </div>
        
        {/* Format Tabs */}
        <Tabs value={format} onValueChange={handleFormatChange}>
          <TabsList>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <div
              ref={editorRef}
              className="w-full h-full border rounded-md"
              style={{ minHeight: '400px' }}
            >
              {/* Monaco Editor would be initialized here */}
              <textarea
                className="w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter document content..."
                spellCheck={false}
              />
            </div>
          </div>
          
          {/* Save Bar */}
          {isDirty && (
            <div className="p-4 border-t bg-yellow-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-700">
                  You have unsaved changes
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setContent(document.content);
                      setIsDirty(false);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Diagnostics Panel */}
        <div className="w-80 border-l bg-gray-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Diagnostics</h3>
            <div className="flex items-center gap-4 mt-2 text-sm">
              {errorCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  {errorCount} errors
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  {warningCount} warnings
                </div>
              )}
              {infoCount > 0 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Info className="w-4 h-4" />
                  {infoCount} info
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {document.diagnostics.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No issues found</p>
              </div>
            ) : (
              <div className="p-2">
                {document.diagnostics.map((diagnostic, index) => (
                  <Alert
                    key={index}
                    className={`mb-2 ${getDiagnosticColor(diagnostic.level)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getDiagnosticIcon(diagnostic.level)}
                      <div className="flex-1">
                        <AlertDescription className="text-sm">
                          <div className="font-medium">{diagnostic.message}</div>
                          <div className="text-xs opacity-75 mt-1">
                            Line {diagnostic.line}, Column {diagnostic.column}
                          </div>
                          {diagnostic.suggestion && (
                            <div className="text-xs mt-1 p-2 bg-white rounded border">
                              <strong>Suggestion:</strong> {diagnostic.suggestion}
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

