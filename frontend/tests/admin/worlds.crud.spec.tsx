/**
 * Worlds CRUD Tests
 * Test name/slug/description functionality, no Reference field
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorldForm } from '@/admin/components/WorldForm';
import { worldsService } from '@/services/admin.worlds';

// Mock the worlds service
vi.mock('@/services/admin.worlds', () => ({
  worldsService: {
    createWorld: vi.fn(),
    updateWorld: vi.fn(),
    getWorld: vi.fn()
  }
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('WorldForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create World', () => {
    it('should render create form with required fields', () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Create World')).toBeInTheDocument();
      expect(screen.getByLabelText('Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Slug *')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Locale')).toBeInTheDocument();
    });

    it('should auto-generate slug from name', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByLabelText('Name *');
      fireEvent.change(nameInput, { target: { value: 'My Test World' } });

      await waitFor(() => {
        const slugInput = screen.getByLabelText('Slug *') as HTMLInputElement;
        expect(slugInput.value).toBe('my-test-world');
      });
    });

    it('should validate required fields', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Slug is required')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should validate slug format', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const slugInput = screen.getByLabelText('Slug *');
      fireEvent.change(slugInput, { target: { value: 'Invalid Slug!' } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Slug must contain only lowercase letters, numbers, and hyphens')).toBeInTheDocument();
      });
    });

    it('should submit valid form data', async () => {
      const mockWorldData = {
        name: 'Test World',
        slug: 'test-world',
        description: 'A test world',
        status: 'draft' as const,
        locale: 'en'
      };

      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Test World' } });
      fireEvent.change(screen.getByLabelText('Slug *'), { target: { value: 'test-world' } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A test world' } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(mockWorldData);
      });
    });

    it('should not show Reference field', () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('Reference')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Reference')).not.toBeInTheDocument();
    });
  });

  describe('Edit World', () => {
    const mockWorld = {
      id: '1',
      name: 'Existing World',
      slug: 'existing-world',
      description: 'An existing world',
      status: 'active' as const,
      locale: 'en',
      owner_user_id: 'user-1',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    it('should render edit form with existing data', () => {
      render(
        <WorldForm
          world={mockWorld}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Edit World')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing World')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing-world')).toBeInTheDocument();
      expect(screen.getByDisplayValue('An existing world')).toBeInTheDocument();
    });

    it('should update existing world', async () => {
      const updatedData = {
        name: 'Updated World',
        slug: 'updated-world',
        description: 'An updated world',
        status: 'active' as const,
        locale: 'en'
      };

      render(
        <WorldForm
          world={mockWorld}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Updated World' } });
      fireEvent.change(screen.getByLabelText('Slug *'), { target: { value: 'updated-world' } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'An updated world' } });

      const submitButton = screen.getByText('Update World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(updatedData);
      });
    });

    it('should not auto-generate slug when editing', async () => {
      render(
        <WorldForm
          world={mockWorld}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByLabelText('Name *');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Slug should not change automatically when editing
      const slugInput = screen.getByLabelText('Slug *') as HTMLInputElement;
      expect(slugInput.value).toBe('existing-world');
    });
  });

  describe('Form Validation', () => {
    it('should validate name length', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByLabelText('Name *');
      fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name must be less than 100 characters')).toBeInTheDocument();
      });
    });

    it('should validate slug length', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const slugInput = screen.getByLabelText('Slug *');
      fireEvent.change(slugInput, { target: { value: 'a'.repeat(51) } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Slug must be less than 50 characters')).toBeInTheDocument();
      });
    });

    it('should validate description length', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const descriptionInput = screen.getByLabelText('Description');
      fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(501) } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Description must be less than 500 characters')).toBeInTheDocument();
      });
    });
  });

  describe('Status and Locale Selection', () => {
    it('should allow status selection', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const statusSelect = screen.getByRole('combobox', { name: 'Status' });
      fireEvent.click(statusSelect);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Archived')).toBeInTheDocument();
      });
    });

    it('should allow locale selection', async () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const localeSelect = screen.getByRole('combobox', { name: 'Locale' });
      fireEvent.click(localeSelect);

      await waitFor(() => {
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('Spanish')).toBeInTheDocument();
        expect(screen.getByText('French')).toBeInTheDocument();
      });
    });
  });

  describe('Form Actions', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show loading state when submitting', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Test World' } });
      fireEvent.change(screen.getByLabelText('Slug *'), { target: { value: 'test-world' } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should handle submission errors', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'));

      render(
        <WorldForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Test World' } });
      fireEvent.change(screen.getByLabelText('Slug *'), { target: { value: 'test-world' } });

      const submitButton = screen.getByText('Create World');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });
});

















