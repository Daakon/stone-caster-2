/**
 * Chat UI Debug Tests
 * Tests for debug panel and dynamic layer indicators
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebugPanel, BlockBadge } from '@/ui/components/chat/DebugPanel';

describe('Debug Panel', () => {
  const mockBlocks = [
    {
      kind: 'core',
      content: 'System-wide core prompt',
      segmentIds: [1, 2],
      tokens: 50
    },
    {
      kind: 'ruleset',
      content: 'D&D 5e rules prompt',
      segmentIds: [3],
      tokens: 100
    },
    {
      kind: 'world',
      content: 'Fantasy world description',
      segmentIds: [4],
      tokens: 75
    },
    {
      kind: 'entry',
      content: 'Adventure setup',
      segmentIds: [5],
      tokens: 60
    },
    {
      kind: 'game_state',
      content: 'Current game state information',
      tokens: 25
    },
    {
      kind: 'player',
      content: 'Player information',
      tokens: 30
    },
    {
      kind: 'rng',
      content: 'Random number generation context',
      tokens: 20
    },
    {
      kind: 'input',
      content: 'Input processing context',
      tokens: 15
    }
  ];

  const mockAssemblyOrder = [
    'core', 'ruleset', 'world', 'entry', 'entry_start', 'npc',
    'game_state', 'player', 'rng', 'input'
  ];

  const mockSegmentIdsByScope = {
    core: [1, 2],
    ruleset: [3],
    world: [4],
    entry: [5],
    entry_start: [],
    npc: []
  };

  describe('BlockBadge', () => {
    it('should show "System-Generated" badge for dynamic layers', () => {
      const dynamicLayers = ['game_state', 'player', 'rng', 'input'];
      
      dynamicLayers.forEach(layer => {
        render(<BlockBadge kind={layer} />);
        expect(screen.getByText('System-Generated')).toBeInTheDocument();
      });
    });

    it('should show "Authored" badge for static layers', () => {
      const staticLayers = ['core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'];
      
      staticLayers.forEach(layer => {
        render(<BlockBadge kind={layer} />);
        expect(screen.getByText('Authored')).toBeInTheDocument();
      });
    });

    it('should have correct styling for system-generated badges', () => {
      render(<BlockBadge kind="game_state" />);
      const badge = screen.getByText('System-Generated');
      expect(badge).toHaveClass('bg-blue-500/10', 'text-blue-400');
    });

    it('should have correct styling for authored badges', () => {
      render(<BlockBadge kind="core" />);
      const badge = screen.getByText('Authored');
      expect(badge).toHaveClass('bg-green-500/10', 'text-green-400');
    });
  });

  describe('DebugPanel', () => {
    it('should render all prompt blocks', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      // Check that all blocks are rendered
      expect(screen.getByText('System-wide core prompt')).toBeInTheDocument();
      expect(screen.getByText('D&D 5e rules prompt')).toBeInTheDocument();
      expect(screen.getByText('Fantasy world description')).toBeInTheDocument();
      expect(screen.getByText('Adventure setup')).toBeInTheDocument();
      expect(screen.getByText('Current game state information')).toBeInTheDocument();
      expect(screen.getByText('Player information')).toBeInTheDocument();
      expect(screen.getByText('Random number generation context')).toBeInTheDocument();
      expect(screen.getByText('Input processing context')).toBeInTheDocument();
    });

    it('should show correct summary statistics', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      // Check summary stats
      expect(screen.getByText('4')).toBeInTheDocument(); // Authored blocks
      expect(screen.getByText('4')).toBeInTheDocument(); // System-generated blocks
      expect(screen.getByText('375')).toBeInTheDocument(); // Total tokens
    });

    it('should display assembly order', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      // Check assembly order badges
      expect(screen.getByText('1. core')).toBeInTheDocument();
      expect(screen.getByText('2. ruleset')).toBeInTheDocument();
      expect(screen.getByText('3. world')).toBeInTheDocument();
      expect(screen.getByText('4. entry')).toBeInTheDocument();
      expect(screen.getByText('5. entry_start')).toBeInTheDocument();
      expect(screen.getByText('6. npc')).toBeInTheDocument();
      expect(screen.getByText('7. game_state')).toBeInTheDocument();
      expect(screen.getByText('8. player')).toBeInTheDocument();
      expect(screen.getByText('9. rng')).toBeInTheDocument();
      expect(screen.getByText('10. input')).toBeInTheDocument();
    });

    it('should display segment IDs by scope', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      // Check segment counts
      expect(screen.getByText('core')).toBeInTheDocument();
      expect(screen.getByText('2 segments')).toBeInTheDocument();
      expect(screen.getByText('ruleset')).toBeInTheDocument();
      expect(screen.getByText('1 segment')).toBeInTheDocument();
    });

    it('should show system-generated info panel', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      expect(screen.getByText('System-Generated Layers')).toBeInTheDocument();
      expect(screen.getByText(/produced at runtime/)).toBeInTheDocument();
      expect(screen.getByText(/not editable in Prompt Segments/)).toBeInTheDocument();
    });

    it('should display token counts for each block', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      expect(screen.getByText('50 tokens')).toBeInTheDocument();
      expect(screen.getByText('100 tokens')).toBeInTheDocument();
      expect(screen.getByText('75 tokens')).toBeInTheDocument();
      expect(screen.getByText('60 tokens')).toBeInTheDocument();
      expect(screen.getByText('25 tokens')).toBeInTheDocument();
      expect(screen.getByText('30 tokens')).toBeInTheDocument();
      expect(screen.getByText('20 tokens')).toBeInTheDocument();
      expect(screen.getByText('15 tokens')).toBeInTheDocument();
    });

    it('should display segment IDs for each block', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      expect(screen.getByText('Segment IDs: 1, 2')).toBeInTheDocument();
      expect(screen.getByText('Segment IDs: 3')).toBeInTheDocument();
      expect(screen.getByText('Segment IDs: 4')).toBeInTheDocument();
      expect(screen.getByText('Segment IDs: 5')).toBeInTheDocument();
    });

    it('should handle empty blocks gracefully', () => {
      render(
        <DebugPanel 
          blocks={[]}
          totalTokens={0}
          assemblyOrder={[]}
          segmentIdsByScope={{}}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument(); // Authored blocks
      expect(screen.getByText('0')).toBeInTheDocument(); // System-generated blocks
      expect(screen.getByText('0')).toBeInTheDocument(); // Total tokens
    });

    it('should show correct block types in headers', () => {
      render(
        <DebugPanel 
          blocks={mockBlocks}
          totalTokens={375}
          assemblyOrder={mockAssemblyOrder}
          segmentIdsByScope={mockSegmentIdsByScope}
        />
      );

      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Ruleset')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
      expect(screen.getByText('Entry')).toBeInTheDocument();
      expect(screen.getByText('Game state')).toBeInTheDocument();
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Rng')).toBeInTheDocument();
      expect(screen.getByText('Input')).toBeInTheDocument();
    });
  });
});
