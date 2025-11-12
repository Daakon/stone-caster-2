/**
 * Snapshot Override Dialog
 * Create manual override snapshot with validation
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { z } from 'zod';

// TurnPacketV3 schema for client-side validation
const TurnPacketV3Schema = z.object({
  tp_version: z.literal('3'),
  contract: z.literal('awf.v1'),
  core: z.object({
    style: z.string().optional(),
    safety: z.array(z.string()).optional().default([]),
    output_rules: z.string().optional(),
  }),
  ruleset: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    params: z.record(z.unknown()).optional(),
    slots: z.record(z.string()).optional().default({}),
  }),
  modules: z.array(z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    params: z.record(z.unknown()).optional(),
  })).optional().default([]),
  world: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
  }),
  scenario: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
  }).optional(),
  npcs: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
  })).optional().default([]),
  state: z.record(z.unknown()).optional(),
  input: z.object({
    kind: z.string().min(1),
    text: z.string().min(1),
  }),
  meta: z.object({
    budgets: z.object({
      max_ctx_tokens: z.number().int().positive().optional(),
    }).optional(),
    seed: z.string().optional(),
    buildId: z.string().optional(),
  }).optional(),
}).strict();

interface SnapshotOverrideDialogProps {
  snapshotId: string;
  onClose: () => void;
  onSuccess: (newSnapshotId: string) => void;
}

export function SnapshotOverrideDialog({
  snapshotId,
  onClose,
  onSuccess,
}: SnapshotOverrideDialogProps) {
  const queryClient = useQueryClient();
  const [linearizedText, setLinearizedText] = useState('');
  const [tpJson, setTpJson] = useState('');
  const [reason, setReason] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch original snapshot
  const { data: original } = useQuery({
    queryKey: ['admin', 'prompt-snapshots', snapshotId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/prompt-snapshots/${snapshotId}`);
      if (!res.ok) throw new Error('Failed to fetch snapshot');
      return res.data;
    },
    onSuccess: (data) => {
      setLinearizedText(data.linearized_prompt_text || '');
      setTpJson(JSON.stringify(data.tp, null, 2));
    },
  });

  // Validate TP JSON
  const validateTp = () => {
    try {
      const parsed = JSON.parse(tpJson);
      const result = TurnPacketV3Schema.safeParse(parsed);
      if (!result.success) {
        setValidationErrors(result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
        return false;
      }
      if (result.data.contract !== 'awf.v1') {
        setValidationErrors(['Contract must be "awf.v1"']);
        return false;
      }
      if (result.data.tp_version !== '3') {
        setValidationErrors(['tp_version must be "3"']);
        return false;
      }
      setValidationErrors([]);
      return true;
    } catch (error) {
      setValidationErrors([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
      return false;
    }
  };

  // Override mutation
  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!validateTp()) {
        throw new Error('Validation failed');
      }
      const parsed = JSON.parse(tpJson);
      const res = await api.post(`/api/admin/prompt-snapshots/${snapshotId}/override`, {
        tp: parsed,
        linearized_prompt_text: linearizedText,
        reason,
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(`Rate limit exceeded. ${res.data?.retryAfter ? `Retry after ${Math.ceil(res.data.retryAfter / 60)} minutes` : 'Please try again later.'}`);
        }
        throw new Error(res.error || 'Failed to create override');
      }
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Override snapshot created');
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-snapshots'] });
      onSuccess(data.data.overrideSnapshotId);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create override');
    },
  });

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    if (!validateTp()) {
      toast.error('Please fix validation errors');
      return;
    }
    overrideMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Override Snapshot</DialogTitle>
          <DialogDescription>
            Create a manual override for snapshot {snapshotId.substring(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Reason (Required)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this override is needed"
            />
          </div>

          <div>
            <Label>Linearized Prompt Text</Label>
            <Textarea
              value={linearizedText}
              onChange={(e) => setLinearizedText(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <Label>TurnPacketV3 JSON</Label>
            <Textarea
              value={tpJson}
              onChange={(e) => {
                setTpJson(e.target.value);
                setValidationErrors([]);
              }}
              onBlur={validateTp}
              rows={12}
              className="font-mono text-xs"
            />
            {validationErrors.length > 0 && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-sm">{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Rate limit: 5 overrides/hour
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={overrideMutation.isPending || validationErrors.length > 0 || !reason.trim()}
              >
                {overrideMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Override'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
