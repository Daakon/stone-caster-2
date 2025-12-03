/**
 * WorldCard Component Tests
 * Phase 10-B: Strict Asset Implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorldCard } from '../WorldCard';
import type { WorldDefinition } from '@shared/types/chimera-authoring';
import type { ChimeraAssetRef } from '@shared/types/chimera-assets';

describe('WorldCard', () => {
  const mockWorldBase: Omit<WorldDefinition, 'images'> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test World',
    description: 'A test world description',
    tags: [],
    character_schema_extensions: {},
    lore_fragments: [],
  };

  describe('Banner Priority Logic', () => {
    it('should prioritize banner role over other images', () => {
      const worldWithBanner: WorldDefinition = {
        ...mockWorldBase,
        images: [
          {
            id: 'icon-id',
            url: 'icon.png',
            role: 'icon',
          },
          {
            id: 'banner-id',
            url: 'banner.png',
            role: 'banner',
          },
        ] as ChimeraAssetRef[],
      };

      const { container } = render(
        <WorldCard world={worldWithBanner} />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('banner.png');
    });

    it('should fall back to first image if no banner exists', () => {
      const worldWithoutBanner: WorldDefinition = {
        ...mockWorldBase,
        images: [
          {
            id: 'gallery-id',
            url: 'random.png',
            role: 'gallery',
          },
        ] as ChimeraAssetRef[],
      };

      const { container } = render(
        <WorldCard world={worldWithoutBanner} />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('random.png');
    });

    it('should use placeholder when no images exist', () => {
      const worldWithoutImages: WorldDefinition = {
        ...mockWorldBase,
        images: [],
      };

      const { container } = render(
        <WorldCard world={worldWithoutImages} />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('/placeholders/world-default.webp');
    });

    it('should use placeholder when images array is undefined', () => {
      const worldWithUndefinedImages: WorldDefinition = {
        ...mockWorldBase,
        images: undefined as any,
      };

      const { container } = render(
        <WorldCard world={worldWithUndefinedImages} />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('/placeholders/world-default.webp');
    });
  });

  describe('Selection State', () => {
    it('should apply selected styling when isSelected is true', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        images: [],
      };

      const { container } = render(
        <WorldCard world={world} isSelected={true} />
      );

      const card = container.querySelector('.ring-2');
      expect(card).toBeTruthy();
    });

    it('should not apply selected styling when isSelected is false', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        images: [],
      };

      const { container } = render(
        <WorldCard world={world} isSelected={false} />
      );

      const card = container.querySelector('.ring-2');
      expect(card).toBeFalsy();
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when card is clicked', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        images: [],
      };

      const handleClick = vi.fn();
      const { container } = render(
        <WorldCard world={world} onClick={handleClick} />
      );

      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeTruthy();
      
      // Simulate click
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content Display', () => {
    it('should display world name', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        name: 'My Test World',
        images: [],
      };

      render(<WorldCard world={world} />);
      expect(screen.getByText('My Test World')).toBeTruthy();
    });

    it('should display world description', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        description: 'This is a test description',
        images: [],
      };

      render(<WorldCard world={world} />);
      expect(screen.getByText('This is a test description')).toBeTruthy();
    });

    it('should display fallback description when description is missing', () => {
      const world: WorldDefinition = {
        ...mockWorldBase,
        description: '',
        images: [],
      };

      render(<WorldCard world={world} />);
      expect(screen.getByText('No description')).toBeTruthy();
    });
  });
});

