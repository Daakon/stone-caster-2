/**
 * Admin API client
 * Functions for admin-only endpoints
 */

import { apiFetch } from './api';

export interface EntryPointPreviewParams {
  rulesetSlug?: string;
  budget?: number;
  warnPct?: number;
  npcLimit?: number;
  includeNpcs?: boolean;
  entryStartSlug?: string;
  qa?: boolean;
}

export interface EntryPointPreviewResponse {
  ok: boolean;
  data: {
    prompt: string;
    pieces: Array<{
      scope: string;
      slug: string;
      version?: string;
      tokens: number;
    }>;
    meta: {
      included: string[];
      dropped: string[];
      policy?: string[];
      tokenEst: {
        input: number;
        budget: number;
        pct: number;
      };
      selectionContext?: any;
      npcTrimmedCount?: number;
      source: string;
      version: string;
    };
    diagnostics: {
      tokenEstDetail: Array<{ id: string; tokens: number }>;
      npcBefore: number;
      npcAfter: number;
      budgetOverrides: {
        budget?: number;
        warnPct?: number;
        npcLimit?: number;
        includeNpcs?: boolean;
      };
      prompt_hash: string;
      byScope?: Record<string, number>;
      qaReport?: Array<{
        type: string;
        piece: string;
        severity: string;
        message: string;
        pct?: number;
      }>;
    };
  };
  meta: {
    traceId: string;
  };
}

/**
 * Preview entry point prompt assembly (admin only)
 */
export async function getEntryPointPreview(
  entryPointId: string,
  params: EntryPointPreviewParams = {}
): Promise<EntryPointPreviewResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.rulesetSlug) {
    searchParams.set('rulesetSlug', params.rulesetSlug);
  }
  if (params.budget !== undefined) {
    searchParams.set('budget', String(params.budget));
  }
  if (params.warnPct !== undefined) {
    searchParams.set('warnPct', String(params.warnPct));
  }
  if (params.npcLimit !== undefined) {
    searchParams.set('npcLimit', String(params.npcLimit));
  }
  if (params.includeNpcs !== undefined) {
    searchParams.set('includeNpcs', params.includeNpcs ? '1' : '0');
  }
  if (params.entryStartSlug) {
    searchParams.set('entryStartSlug', params.entryStartSlug);
  }
  if (params.qa) {
    searchParams.set('qa', '1');
  }

  const url = `/api/admin/preview/entry-point/${entryPointId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const result = await apiFetch<EntryPointPreviewResponse>(url, {
    method: 'GET',
    headers: {
      'X-Debug-Token': import.meta.env.VITE_DEBUG_ROUTES_TOKEN || '',
    },
  });

  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to preview entry point');
  }

  return result.data;
}

