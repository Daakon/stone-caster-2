import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CharacterCard from './CharacterCard';

const mockCharacter = {
  id: 'char-1',
  name: 'Test Character',
  portrait_seed: 'seed1',
  portrait_url: 'https://example.com/portrait1.jpg',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

describe('CharacterCard', () => {
  it('renders character information', () => {
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={mockCharacter}
        isSelected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByAltText('Test Character')).toBeInTheDocument();
  });

  it('shows selected state when selected', () => {
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={mockCharacter}
        isSelected={true}
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveClass('ring-2', 'ring-primary');
    // Check icon is present (rendered as SVG, not text)
    expect(card.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={mockCharacter}
        isSelected={false}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(mockOnSelect).toHaveBeenCalledWith(mockCharacter);
  });

  it('handles missing portrait URL', () => {
    const characterWithoutPortrait = {
      ...mockCharacter,
      portrait_url: undefined,
    };
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={characterWithoutPortrait}
        isSelected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Test Character')).toBeInTheDocument();
    // Should still render the card even without portrait
  });

  it('handles missing portrait seed', () => {
    const characterWithoutSeed = {
      ...mockCharacter,
      portrait_seed: undefined,
    };
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={characterWithoutSeed}
        isSelected={false}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('is keyboard accessible', () => {
    const mockOnSelect = vi.fn();
    
    render(
      <CharacterCard
        character={mockCharacter}
        isSelected={false}
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
    
    // Test keyboard interaction
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnSelect).toHaveBeenCalledWith(mockCharacter);
  });
});
