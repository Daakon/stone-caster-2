/**
 * Access Request Validation Schemas
 * Phase B5: Zod schemas for access request endpoints
 */

import { z } from 'zod';

/**
 * Normalize email: lowercase and trim
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Simple email validation (RFC 5322 subset)
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Public request schema
 */
export const publicRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .max(254, 'Email too long')
      .transform(normalizeEmail)
      .refine(isValidEmail, 'Invalid email format'),
    note: z.string().trim().max(500, 'Note too long').optional(),
    newsletter: z.boolean().optional(),
    honeypot: z.string().optional(), // Bot detection field (should be empty)
  })
  .refine((data) => !data.honeypot || data.honeypot === '', {
    message: 'Bot detected',
    path: ['honeypot'],
  });

export type PublicRequestInput = z.infer<typeof publicRequestSchema>;

/**
 * Admin list query schema
 */
export const adminListSchema = z.object({
  status: z.enum(['pending', 'approved', 'denied']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50), // Changed from pageSize to limit to match other admin endpoints
  orderBy: z.enum(['created_at', 'updated_at', 'email']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminListInput = z.infer<typeof adminListSchema>;

/**
 * Deny request body schema
 */
export const denyRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason too long'),
});

export type DenyRequestInput = z.infer<typeof denyRequestSchema>;

/**
 * Approve request body schema (no body required, but can accept optional note)
 */
export const approveRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ApproveRequestInput = z.infer<typeof approveRequestSchema>;

