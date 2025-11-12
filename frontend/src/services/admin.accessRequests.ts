/**
 * Admin Access Requests Service
 * Phase B5: API client for managing access requests
 */

import { apiFetch } from '@/lib/api';
import type {
  AccessRequest,
  AccessRequestListResponse,
  ApproveRequestResponse,
  DenyRequestResponse,
} from '@shared/types/accessRequests';

export interface ListAccessRequestsParams {
  status?: 'pending' | 'approved' | 'denied';
  q?: string;
  page?: number;
  limit?: number; // Changed from pageSize to limit to match other admin endpoints
  orderBy?: 'created_at' | 'updated_at' | 'email';
  order?: 'asc' | 'desc';
}

export const accessRequestsService = {
  /**
   * List access requests with filtering and pagination
   */
  async list(params: ListAccessRequestsParams = {}): Promise<AccessRequestListResponse> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.set('status', params.status);
    if (params.q) queryParams.set('q', params.q);
    queryParams.set('page', String(params.page || 1));
    queryParams.set('limit', String(params.limit || 50)); // Changed from pageSize to limit
    queryParams.set('orderBy', params.orderBy || 'created_at');
    queryParams.set('order', params.order || 'desc');

    const result = await apiFetch<AccessRequestListResponse>(
      `/api/admin/access-requests?${queryParams.toString()}`
    );

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch access requests');
    }

    return result.data;
  },

  /**
   * Approve an access request
   */
  async approve(requestId: string, note?: string): Promise<ApproveRequestResponse> {
    const result = await apiFetch<ApproveRequestResponse>(
      `/api/admin/access-requests/${requestId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    );

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to approve request');
    }

    return result.data;
  },

  /**
   * Deny an access request
   */
  async deny(requestId: string, reason: string): Promise<DenyRequestResponse> {
    const result = await apiFetch<DenyRequestResponse>(
      `/api/admin/access-requests/${requestId}/deny`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to deny request');
    }

    return result.data;
  },
};

