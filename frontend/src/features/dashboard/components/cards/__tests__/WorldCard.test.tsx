import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorldCard } from '../WorldCard';
import type { ChimeraWorldV2 } from '@/types/chimera-v2';

// Mock data
const MOCK_WORLD_NO_IMAGE: ChimeraWorldV2 = {
    id: 'w1',
    display_name: 'Test World',
    tags: ['Fantasy'],
    status: 'draft',
    updated_at: '2024-01-01T00:00:00Z',
    images: []
};

const MOCK_WORLD_WITH_IMAGE: ChimeraWorldV2 = {
    ...MOCK_WORLD_NO_IMAGE,
    images: [
        {
            id: 'img1',
            url: 'https://example.com/image.jpg',
            role: 'banner',
            storage_path: 'path/to/img',
            original_filename: 'image.jpg',
            mime_type: 'image/jpeg',
            size_bytes: 1024,
            created_at: '2024-01-01T00:00:00Z'
        }
    ]
};

describe('WorldCard', () => {
    it('renders correctly without image (fallback to gradient)', () => {
        render(<WorldCard data={MOCK_WORLD_NO_IMAGE} />);

        expect(screen.getByText('Test World')).toBeInTheDocument();
        expect(screen.getByText('Fantasy')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
    });

    it('renders correctly with image', () => {
        const { container } = render(<WorldCard data={MOCK_WORLD_WITH_IMAGE} />);

        expect(screen.getByText('Test World')).toBeInTheDocument();
        // Check for style attribute containing the image url
        // This is a bit implementation detail specific, checking if background-image is applied
        const styleDiv = container.querySelector('.aspect-video');
        expect(styleDiv).toHaveStyle(`background-image: url(https://example.com/image.jpg)`);
    });

    it('does not crash if tags are missing', () => {
        const dataWithoutTags = { ...MOCK_WORLD_NO_IMAGE, tags: [] };
        render(<WorldCard data={dataWithoutTags} />);
        expect(screen.getByText('Test World')).toBeInTheDocument();
    });
});
