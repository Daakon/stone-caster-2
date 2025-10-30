import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import StoryStartSummary from './StoryStartSummary';

const mockStory = {
  id: '1',
  title: 'Test Story',
  short_desc: 'A test story description',
  hero_image_url: 'https://example.com/hero.jpg',
  world_id: 'world-1',
  kind: 'adventure' as const,
  status: 'active' as const,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockCharacter = {
  id: 'char-1',
  name: 'Test Character',
  portrait_seed: 'seed1',
  portrait_url: 'https://example.com/portrait1.jpg',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

describe('StoryStartSummary', () => {
  it('renders story and character information', () => {
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={mockStory}
        character={mockCharacter}
        onBegin={mockOnBegin}
        isPending={false}
      />
    );

    expect(screen.getByText('Test Story')).toBeInTheDocument();
    expect(screen.getByText('A test story description')).toBeInTheDocument();
    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByText('Begin Story')).toBeInTheDocument();
  });

  it('calls onBegin when Begin Story is clicked', () => {
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={mockStory}
        character={mockCharacter}
        onBegin={mockOnBegin}
        isPending={false}
      />
    );

    fireEvent.click(screen.getByText('Begin Story'));
    expect(mockOnBegin).toHaveBeenCalled();
  });

  it('shows loading state when pending', () => {
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={mockStory}
        character={mockCharacter}
        onBegin={mockOnBegin}
        isLoading={true}
      />
    );

    expect(screen.getByText('Starting...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
  });

  it('handles missing hero image', () => {
    const storyWithoutImage = {
      ...mockStory,
      hero_image_url: undefined,
    };
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={storyWithoutImage}
        character={mockCharacter}
        onBegin={mockOnBegin}
        isPending={false}
      />
    );

    expect(screen.getByText('Test Story')).toBeInTheDocument();
    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('handles missing character portrait', () => {
    const characterWithoutPortrait = {
      ...mockCharacter,
      portrait_url: undefined,
    };
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={mockStory}
        character={characterWithoutPortrait}
        onBegin={mockOnBegin}
        isPending={false}
      />
    );

    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('is keyboard accessible', () => {
    const mockOnBegin = vi.fn();
    
    render(
      <StoryStartSummary
        story={mockStory}
        character={mockCharacter}
        onBegin={mockOnBegin}
        isPending={false}
      />
    );

    const button = screen.getByText('Begin Story');
    expect(button).toBeInTheDocument();
    
    // Test keyboard interaction
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnBegin).toHaveBeenCalled();
  });
});
