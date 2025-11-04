/**
 * Entry Points Multi-Ruleset Tests
 * Test multi-select and ordering functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntryRulesetsPicker } from '@/admin/components/EntryRulesetsPicker';
import { rulesetsService } from '@/services/admin.rulesets';

// Mock the rulesets service
vi.mock('@/services/admin.rulesets', () => ({
  rulesetsService: {
    getActiveRulesets: vi.fn()
  }
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('EntryRulesetsPicker', () => {
  const mockRulesets = [
    { id: '1', name: 'D&D 5e', slug: 'dnd-5e', active: true },
    { id: '2', name: 'Pathfinder', slug: 'pathfinder', active: true },
    { id: '3', name: 'Call of Cthulhu', slug: 'call-of-cthulhu', active: true },
    { id: '4', name: 'Vampire: The Masquerade', slug: 'vampire-masquerade', active: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (rulesetsService.getActiveRulesets as any).mockResolvedValue(mockRulesets);
  });

  it('should render empty state initially', () => {
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    expect(screen.getByText('No rulesets selected')).toBeInTheDocument();
    expect(screen.getByText('Add rulesets using the search above')).toBeInTheDocument();
  });

  it('should load and display available rulesets', async () => {
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    // Open the select dropdown
    const selectTrigger = screen.getByText('Select ruleset...');
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      expect(screen.getByText('D&D 5e (dnd-5e)')).toBeInTheDocument();
      expect(screen.getByText('Pathfinder (pathfinder)')).toBeInTheDocument();
    });
  });

  it('should add rulesets when selected', async () => {
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    // Open the select dropdown
    const selectTrigger = screen.getByText('Select ruleset...');
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      expect(screen.getByText('D&D 5e (dnd-5e)')).toBeInTheDocument();
    });

    // Select a ruleset
    fireEvent.click(screen.getByText('D&D 5e (dnd-5e)'));

    expect(mockOnChange).toHaveBeenCalledWith([
      {
        id: '1',
        name: 'D&D 5e',
        slug: 'dnd-5e',
        sort_order: 0
      }
    ]);
  });

  it('should display selected rulesets with correct order', () => {
    const selectedRulesets = [
      { id: '1', name: 'D&D 5e', slug: 'dnd-5e', sort_order: 0 },
      { id: '2', name: 'Pathfinder', slug: 'pathfinder', sort_order: 1 }
    ];
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={selectedRulesets}
        onRulesetsChange={mockOnChange}
      />
    );

    expect(screen.getByText('D&D 5e')).toBeInTheDocument();
    expect(screen.getByText('Pathfinder')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('should remove rulesets when X is clicked', () => {
    const selectedRulesets = [
      { id: '1', name: 'D&D 5e', slug: 'dnd-5e', sort_order: 0 },
      { id: '2', name: 'Pathfinder', slug: 'pathfinder', sort_order: 1 }
    ];
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={selectedRulesets}
        onRulesetsChange={mockOnChange}
      />
    );

    // Find and click the remove button for the first ruleset
    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(button => 
      button.querySelector('svg') && button.getAttribute('aria-label') !== 'Add'
    );
    
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    expect(mockOnChange).toHaveBeenCalledWith([
      { id: '2', name: 'Pathfinder', slug: 'pathfinder', sort_order: 0 }
    ]);
  });

  it('should filter available rulesets by search query', async () => {
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search rulesets...');
    fireEvent.change(searchInput, { target: { value: 'dnd' } });

    // Open the select dropdown
    const selectTrigger = screen.getByText('Select ruleset...');
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      expect(screen.getByText('D&D 5e (dnd-5e)')).toBeInTheDocument();
      expect(screen.queryByText('Pathfinder (pathfinder)')).not.toBeInTheDocument();
    });
  });

  it('should exclude already selected rulesets from dropdown', async () => {
    const selectedRulesets = [
      { id: '1', name: 'D&D 5e', slug: 'dnd-5e', sort_order: 0 }
    ];
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={selectedRulesets}
        onRulesetsChange={mockOnChange}
      />
    );

    // Open the select dropdown
    const selectTrigger = screen.getByText('Select ruleset...');
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      expect(screen.queryByText('D&D 5e (dnd-5e)')).not.toBeInTheDocument();
      expect(screen.getByText('Pathfinder (pathfinder)')).toBeInTheDocument();
    });
  });

  it('should handle drag and drop reordering', () => {
    const selectedRulesets = [
      { id: '1', name: 'D&D 5e', slug: 'dnd-5e', sort_order: 0 },
      { id: '2', name: 'Pathfinder', slug: 'pathfinder', sort_order: 1 }
    ];
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={selectedRulesets}
        onRulesetsChange={mockOnChange}
      />
    );

    const rulesetItems = screen.getAllByText(/D&D 5e|Pathfinder/);
    const firstItem = rulesetItems[0].closest('[draggable]');
    
    if (firstItem) {
      // Simulate drag start
      fireEvent.dragStart(firstItem, {
        dataTransfer: {
          effectAllowed: 'move'
        }
      });

      // Simulate drag over second item
      const secondItem = rulesetItems[1].closest('[draggable]');
      if (secondItem) {
        fireEvent.dragOver(secondItem);
        fireEvent.drop(secondItem);
      }
    }

    // The component should call onChange with reordered items
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should show correct sort order numbers', () => {
    const selectedRulesets = [
      { id: '1', name: 'D&D 5e', slug: 'dnd-5e', sort_order: 0 },
      { id: '2', name: 'Pathfinder', slug: 'pathfinder', sort_order: 1 },
      { id: '3', name: 'Call of Cthulhu', slug: 'call-of-cthulhu', sort_order: 2 }
    ];
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={selectedRulesets}
        onRulesetsChange={mockOnChange}
      />
    );

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
        disabled={true}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search rulesets...');
    const selectTrigger = screen.getByText('Select ruleset...');
    
    expect(searchInput).toBeDisabled();
    expect(selectTrigger).toBeDisabled();
  });

  it('should show loading state while fetching rulesets', async () => {
    // Mock a delayed response
    (rulesetsService.getActiveRulesets as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockRulesets), 100))
    );

    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    // Initially should show loading or empty state
    expect(screen.getByText('No rulesets selected')).toBeInTheDocument();

    // Wait for rulesets to load
    await waitFor(() => {
      expect(rulesetsService.getActiveRulesets).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('should handle errors when loading rulesets', async () => {
    (rulesetsService.getActiveRulesets as any).mockRejectedValue(
      new Error('Failed to load rulesets')
    );

    const mockOnChange = vi.fn();
    
    render(
      <EntryRulesetsPicker
        selectedRulesets={[]}
        onRulesetsChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(rulesetsService.getActiveRulesets).toHaveBeenCalled();
    });
  });
});













