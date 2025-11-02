/**
 * Admin Story Preview Page
 * Full preview interface for story prompt assembly
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PreviewControls } from '@/components/admin/preview/PreviewControls';
import { PreviewPromptPanel } from '@/components/admin/preview/PreviewPromptPanel';
import { PreviewPiecesTable } from '@/components/admin/preview/PreviewPiecesTable';
import { PreviewMetaBar } from '@/components/admin/preview/PreviewMetaBar';
import { PreviewQASection } from '@/components/admin/preview/PreviewQASection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getEntryPointPreview, type EntryPointPreviewResponse } from '@/lib/api.admin';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useLiveRegion } from '@/hooks/useLiveRegion';

const DEFAULT_BUDGET = 8000;
const DEFAULT_WARN_PCT = 0.9;

export default function EntryPointPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const liveRegion = useLiveRegion();

  const [previewParams, setPreviewParams] = useState<{
    budget?: number;
    warnPct?: number;
    npcLimit?: number;
    includeNpcs: boolean;
    entryStartSlug?: string;
    qa?: boolean;
  }>({
    includeNpcs: true,
    qa: true,
  });

  const { data, isLoading, error, refetch } = useQuery<EntryPointPreviewResponse>({
    queryKey: ['entry-point-preview', id, previewParams],
    queryFn: () => {
      if (!id) throw new Error('Entry point ID required');
      return getEntryPointPreview(id, previewParams);
    },
    enabled: !!id,
    retry: false,
  });

  // Announce changes via aria-live
  useEffect(() => {
    if (data?.data.diagnostics) {
      const { npcBefore, npcAfter } = data.data.diagnostics;
      if (npcBefore !== npcAfter) {
        const trimmed = npcBefore - npcAfter;
        liveRegion.announce(`NPCs trimmed from ${npcBefore} to ${npcAfter} (${trimmed} removed)`);
      }
    }
  }, [data, liveRegion]);

  const handleExportJSON = () => {
    if (!data) return;

    const exportData = {
      entryPointId: id,
      timestamp: new Date().toISOString(),
      preview: data.data,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entry-point-preview-${id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Preview exported as JSON');
  };

  const handlePieceClick = (pieceId: string) => {
    // Scroll to piece in prompt or highlight in table
    // For now, just show a toast
    toast.info(`Piece: ${pieceId}`);
  };

  if (!id) {
    return (
      <div className="container mx-auto p-6">
        <p>Entry point ID required</p>
        <Button onClick={() => navigate('/admin')}>Back to Admin</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">Error loading preview: {error instanceof Error ? error.message : String(error)}</p>
        <Button onClick={() => navigate('/admin')}>Back to Admin</Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { prompt, pieces, meta, diagnostics } = data.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Story Preview</h1>
        <Button onClick={handleExportJSON} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export JSON
        </Button>
      </div>

      {/* Controls */}
      <PreviewControls
        defaultBudget={DEFAULT_BUDGET}
        defaultWarnPct={DEFAULT_WARN_PCT}
        entryPointId={id}
        onParamsChange={setPreviewParams}
        disabled={isLoading}
      />

      {/* Meta Bar */}
      <PreviewMetaBar
        tokenEst={meta.tokenEst}
        npcBefore={diagnostics.npcBefore}
        npcAfter={diagnostics.npcAfter}
        byScope={diagnostics.byScope}
      />

      {/* Prompt Panel */}
      <PreviewPromptPanel
        prompt={prompt}
        promptHash={diagnostics.prompt_hash}
      />

      {/* Pieces Table */}
      <PreviewPiecesTable
        pieces={pieces}
        policy={meta.policy}
        qaReport={diagnostics.qaReport}
        onPieceClick={handlePieceClick}
      />

      {/* QA Section */}
      {diagnostics.qaReport && diagnostics.qaReport.length > 0 && (
        <PreviewQASection
          qaReport={diagnostics.qaReport}
          onPieceClick={handlePieceClick}
        />
      )}

      {/* Live region for announcements */}
      <div {...liveRegion.props} />
    </div>
  );
}

