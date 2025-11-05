/**
 * Access Request Types
 * Phase B5: Early Access request pipeline types
 */

export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export type AccessRequest = {
  id: string;
  email: string;
  user_id: string | null;
  note: string | null;
  status: AccessRequestStatus;
  reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  denied_by: string | null;
  denied_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublicAccessRequest = {
  email: string;
  note?: string;
  newsletter?: boolean; // Optional newsletter opt-in
};

export type PublicAccessRequestResponse = {
  ok: true;
  data: {
    id: string;
    status: AccessRequestStatus;
    message?: string;
  };
} | {
  ok: false;
  code: 'RATE_LIMITED' | 'VALIDATION_FAILED' | 'INTERNAL_ERROR';
  message?: string;
};

export type AccessRequestStatusResponse = {
  ok: true;
  data: AccessRequest | null;
} | {
  ok: false;
  code: 'UNAUTHORIZED' | 'NOT_FOUND';
  message?: string;
};

export type AccessRequestListMeta = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  status?: AccessRequestStatus;
  q?: string;
};

export type AccessRequestListResponse = {
  ok: true;
  meta: AccessRequestListMeta;
  data: AccessRequest[];
};

export type ApproveRequestResponse = {
  ok: true;
  data: {
    requestId: string;
    userId: string | null;
    roleUpdated: boolean;
    roleVersion: number | null;
  };
} | {
  ok: false;
  code: 'NOT_FOUND' | 'ALREADY_PROCESSED' | 'FORBIDDEN' | 'INTERNAL_ERROR';
  message?: string;
};

export type DenyRequestResponse = {
  ok: true;
  data: {
    requestId: string;
  };
} | {
  ok: false;
  code: 'NOT_FOUND' | 'ALREADY_PROCESSED' | 'FORBIDDEN' | 'INTERNAL_ERROR';
  message?: string;
};

export type DenyRequestBody = {
  reason: string;
};

