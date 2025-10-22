/**
 * Prompt Segments Scope Tests
 * Tests for admin UI scope validation and filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SegmentFormModal } from '@/admin/components/SegmentFormModal';
import { PromptSegmentsAdmin } from '@/pages/admin/prompt-segments/index';

// Mock dependencies
vi.mock('@/services/admin.segments', () => ({
  segmentsService: {
    listSegments: vi.fn(() => Promise.resolve({ data: [], hasMore: false })),
    createSegment: vi.fn(() => Promise.resolve({})),
    updateSegment: vi.fn(() => Promise.resolve({})),
    deleteSegment: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('@/services/admin.refs', () => ({
  refsService: {
    getRefs: vi.fn(() => Promise.resolve([]))
  }
}));

vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: true,
    isModerator: true,
    isAdmin: true
  })
}));

describe('Prompt Segments Scope Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SegmentFormModal', () => {
    it('should only show allowed scopes in dropdown', () => {
      render(
        <SegmentFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Check that allowed scopes are present
      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Ruleset')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
      expect(screen.getByText('Entry')).toBeInTheDocument();
      expect(screen.getByText('Entry Start')).toBeInTheDocument();
      expect(screen.getByText('NPC')).toBeInTheDocument();

      // Check that deprecated scopes are not present
      expect(screen.queryByText('Game State')).not.toBeInTheDocument();
      expect(screen.queryByText('Player')).not.toBeInTheDocument();
      expect(screen.queryByText('RNG')).not.toBeInTheDocument();
      expect(screen.queryByText('Input')).not.toBeInTheDocument();
    });

    it('should show contextual help for scope references', () => {
      render(
        <SegmentFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Select a scope that requires reference
      const scopeSelect = screen.getByRole('combobox', { name: /scope/i });
      fireEvent.click(scopeSelect);
      fireEvent.click(screen.getByText('Ruleset'));

      // Should show reference picker
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });

    it('should not show reference picker for core scope', () => {
      render(
        <SegmentFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Select core scope
      const scopeSelect = screen.getByRole('combobox', { name: /scope/i });
      fireEvent.click(scopeSelect);
      fireEvent.click(screen.getByText('Core'));

      // Should not show reference picker
      expect(screen.queryByText('Reference')).not.toBeInTheDocument();
    });
  });

  describe('PromptSegmentsAdmin', () => {
    it('should only show allowed scopes in filter dropdown', () => {
      render(<PromptSegmentsAdmin />);

      // Open scope filter
      const scopeFilter = screen.getByRole('combobox', { name: /scope/i });
      fireEvent.click(scopeFilter);

      // Check that allowed scopes are present
      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Ruleset')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
      expect(screen.getByText('Entry')).toBeInTheDocument();
      expect(screen.getByText('Entry Start')).toBeInTheDocument();
      expect(screen.getByText('NPC')).toBeInTheDocument();

      // Check that deprecated scopes are not present
      expect(screen.queryByText('Game State')).not.toBeInTheDocument();
      expect(screen.queryByText('Player')).not.toBeInTheDocument();
      expect(screen.queryByText('RNG')).not.toBeInTheDocument();
      expect(screen.queryByText('Input')).not.toBeInTheDocument();
    });

    it('should show warning for deprecated scope filters in URL', async () => {
      // Mock URL with deprecated scope
      const mockLocation = {
        search: '?scope=game_state'
      };
      
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      render(<PromptSegmentsAdmin />);

      // Should show warning about deprecated scopes
      await waitFor(() => {
        expect(screen.getByText(/deprecated.*read-only/i)).toBeInTheDocument();
      });
    });
  });

  describe('Scope Descriptions', () => {
    it('should show appropriate descriptions for each scope', () => {
      render(
        <SegmentFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Test core scope description
      const scopeSelect = screen.getByRole('combobox', { name: /scope/i });
      fireEvent.click(scopeSelect);
      fireEvent.click(screen.getByText('Core'));

      // Should show core description
      expect(screen.getByText(/System-wide prompts available everywhere/i)).toBeInTheDocument();
    });
  });
});
