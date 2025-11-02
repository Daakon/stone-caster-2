/**
 * Preview QA Section
 * Filterable QA report with severity chips
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, AlertTriangle, Info, Download } from 'lucide-react';
import { toast } from 'sonner';

export type QASeverity = 'error' | 'warn' | 'info';

export interface QAReportItem {
  type: string;
  piece: string;
  severity: QASeverity;
  message: string;
  pct?: number;
}

export interface PreviewQASectionProps {
  qaReport: QAReportItem[];
  onPieceClick?: (piece: string) => void;
}

export function PreviewQASection({
  qaReport,
  onPieceClick,
}: PreviewQASectionProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<QASeverity | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    return qaReport.filter((item) => {
      if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) {
        return false;
      }
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [qaReport, selectedSeverity, selectedType]);

  const severities: QASeverity[] = ['error', 'warn', 'info'];
  const types = Array.from(new Set(qaReport.map(item => item.type)));

  const getSeverityIcon = (severity: QASeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: QASeverity) => {
    return (
      <Badge
        variant={
          severity === 'error'
            ? 'destructive'
            : severity === 'warn'
            ? 'default'
            : 'outline'
        }
      >
        {severity}
      </Badge>
    );
  };

  if (qaReport.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/10">
        <p className="text-sm text-green-800 dark:text-green-400">
          ✓ No QA issues found
        </p>
      </div>
    );
  }

  const handleExportCSV = () => {
    const csvRows = [
      ['Type', 'Piece', 'Severity', 'Message', 'Pct'].join(','),
      ...qaReport.map(item => [
        item.type,
        item.piece,
        item.severity,
        `"${item.message.replace(/"/g, '""')}"`,
        item.pct ? item.pct.toFixed(4) : '',
      ].join(',')),
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('QA report exported as CSV');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">QA Report ({qaReport.length})</h3>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedSeverity === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedSeverity('all')}
        >
          All Severities
        </Button>
        {severities.map((sev) => {
          const count = qaReport.filter((item) => item.severity === sev).length;
          if (count === 0) return null;
          return (
            <Button
              key={sev}
              variant={selectedSeverity === sev ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSeverity(sev)}
            >
              {getSeverityIcon(sev)}
              <span className="ml-2">{sev} ({count})</span>
            </Button>
          );
        })}

        {types.length > 0 && (
          <>
            <div className="w-px bg-border" />
            <Button
              variant={selectedType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('all')}
            >
              All Types
            </Button>
            {types.map((type) => {
              const count = qaReport.filter((item) => item.type === type).length;
              return (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                >
                  {type} ({count})
                </Button>
              );
            })}
          </>
        )}
      </div>

      {/* QA Items */}
      <ScrollArea className="border rounded-md max-h-[400px]">
        <div className="p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items match filters</p>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 border rounded-md hover:bg-muted cursor-pointer ${
                  item.severity === 'error'
                    ? 'border-destructive'
                    : item.severity === 'warn'
                    ? 'border-yellow-500'
                    : 'border-blue-500'
                }`}
                onClick={() => onPieceClick?.(item.piece)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onPieceClick?.(item.piece);
                  }
                }}
                aria-label={`QA issue: ${item.type} - ${item.message}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityIcon(item.severity)}
                      <span className="font-medium text-sm">{item.type}</span>
                      {getSeverityBadge(item.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {item.piece}
                    </p>
                    {item.pct !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Uses {Math.round(item.pct * 100)}% of budget
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

