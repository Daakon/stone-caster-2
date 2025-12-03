/**
 * ImageUploader Component Test
 * Tests image upload functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUploader } from './ImageUploader';

// Mock API
vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ImageUploader', () => {
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock FileReader
    global.FileReader = vi.fn().mockImplementation(() => ({
      readAsDataURL: vi.fn(function (this: any) {
        setTimeout(() => {
          this.onload({ target: { result: 'data:image/png;base64,test' } });
        }, 0);
      }),
      onload: null,
    })) as any;
  });

  it('should render upload zone', () => {
    render(<ImageUploader onUploadComplete={mockOnUploadComplete} />);
    expect(screen.getByText(/drag & drop an image here/i)).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    const { apiPost } = await import('@/lib/api');
    const mockApiPost = vi.mocked(apiPost);
    
    mockApiPost.mockResolvedValue({
      ok: true,
      data: {
        uploadUrl: 'https://upload.example.com/upload',
        accessUrl: 'https://cdn.example.com/image.jpg',
        path: 'worlds/test-id',
      },
    });

    // Mock fetch for upload
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload image/i) as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/chimera/assets/sign-upload', {
        filename: 'test.png',
        fileType: 'image/png',
        folder: 'worlds',
      });
    });
  });

  it('should call onUploadComplete after successful upload', async () => {
    const { apiPost } = await import('@/lib/api');
    const mockApiPost = vi.mocked(apiPost);
    
    mockApiPost.mockResolvedValue({
      ok: true,
      data: {
        uploadUrl: 'https://upload.example.com/upload',
        accessUrl: 'https://cdn.example.com/image.jpg',
        path: 'worlds/test-id',
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload image/i) as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith('https://cdn.example.com/image.jpg');
    });
  });

  it('should validate file type', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload image/i) as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/file must be an image/i)).toBeInTheDocument();
    });
  });

  it('should validate file size', async () => {
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });
    const input = screen.getByLabelText(/upload image/i) as HTMLInputElement;

    await userEvent.upload(input, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file size.*exceeds maximum/i)).toBeInTheDocument();
    });
  });
});

