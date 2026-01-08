/**
 * Public Access Requests Service
 * Phase B5: API client for submitting access requests
 */

import { apiFetch } from '@/lib/api';
import type {
  PublicAccessRequestResponse,
  AccessRequestStatusResponse,
  PublicAccessRequest,
  AccessRequest,
} from '@shared/types/accessRequests';

export const publicAccessRequestsService = {
  /**
   * Submit an access request
   */
  async submit(data: PublicAccessRequest): Promise<PublicAccessRequestResponse> {
    const result = await apiFetch<PublicAccessRequestResponse>('/api/request-access', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.ok) {
      const errorCode = result.error.code;
      const validCode = (errorCode === 'RATE_LIMITED' || errorCode === 'VALIDATION_FAILED' || errorCode === 'INTERNAL_ERROR')
        ? errorCode
        : 'INTERNAL_ERROR';
      return {
        ok: false,
        code: validCode,
        message: result.error.message || 'Failed to submit request',
      };
    }

    return result.data;
  },

  /**
   * Get status of user's latest request
   */
  async getStatus(): Promise<AccessRequestStatusResponse> {
    const result = await apiFetch<{ request: AccessRequest | null }>('/api/request-access/status');

    if (!result.ok) {
      const errorCode = result.error.code;
      const validCode = (errorCode === 'UNAUTHORIZED' || errorCode === 'NOT_FOUND')
        ? errorCode
        : 'UNAUTHORIZED';
      return {
        ok: false,
        code: validCode,
        message: result.error.message || 'Failed to fetch status',
      };
    }

    // API returns { request: AccessRequest | null }
    // Transform to AccessRequestStatusResponse shape
    return {
      ok: true,
      data: result.data.request,
    };
  },
};

