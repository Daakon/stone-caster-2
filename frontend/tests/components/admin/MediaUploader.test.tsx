/**
 * MediaUploader Component Tests
 * Phase 3a: Unit tests for admin image uploader
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { apiPost } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
}));

vi.mock('@/lib/apiBase', () => ({
  apiUrl: (path: string) => `http://localhost:3000${path}`,
}));

vi.mock('@shared/media/url', () => ({
  buildImageUrl: (imageId: string, variant: string, deliveryUrl?: string) => {
    return deliveryUrl ? `${deliveryUrl}/${imageId}/${variant}` : `/images/${imageId}/${variant}`;
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
          },
        },
      }),
    },
  },
}));

// Mock fetch for Cloudflare upload
global.fetch = vi.fn();

describe('MediaUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  it('should render upload button', () => {
    render(<MediaUploader kind="world" />);
    expect(screen.getByText('Upload image')).toBeInTheDocument();
  });

  it('should call onUploaded after successful upload', async () => {
    const onUploaded = vi.fn();
    const user = userEvent.setup();

    // Mock upload request
    (apiPost as any).mockResolvedValueOnce({
      ok: true,
      data: {
        uploadURL: 'https://upload.imagedelivery.net/upload',
        media: {
          id: 'media-123',
          provider_key: 'cf-image-456',
          status: 'pending',
        },
      },
    });

    // Mock Cloudflare upload
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Mock finalize
    (apiPost as any).mockResolvedValueOnce({
      ok: true,
      data: {
        media: {
          id: 'media-123',
          provider_key: 'cf-image-456',
          status: 'ready',
          width: 1920,
          height: 1080,
          image_review_status: 'pending',
        },
      },
    });

    render(<MediaUploader kind="world" onUploaded={onUploaded} />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Select image file') as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'media-123',
          status: 'ready',
        })
      );
    });
  });

  it('should show error on upload failure', async () => {
    const user = userEvent.setup();

    (apiPost as any).mockResolvedValueOnce({
      ok: false,
      error: { message: 'Upload request failed' },
    });

    render(<MediaUploader kind="world" />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Select image file') as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/Upload request failed/)).toBeInTheDocument();
    });
  });

  it('should show loading state during upload', async () => {
    const user = userEvent.setup();

    (apiPost as any).mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        data: {
          uploadURL: 'https://upload.imagedelivery.net/upload',
          media: { id: 'media-123', provider_key: 'cf-456' },
        },
      }), 100))
    );

    render(<MediaUploader kind="world" />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Select image file') as HTMLInputElement;

    await user.upload(input, file);

    expect(screen.getByText(/Uploading/)).toBeInTheDocument();
  });
});



