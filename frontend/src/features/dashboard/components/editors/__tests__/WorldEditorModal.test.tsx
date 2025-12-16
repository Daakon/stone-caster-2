import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WorldEditorModal } from '../WorldEditorModal';
import * as ChimeraApi from '@/services/chimera-api';

// Mock API
vi.mock('@/services/chimera-api', () => ({
    useCreateWorld: vi.fn(),
}));

// Mock Dialog
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <div>{children}</div>,
    DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

describe('WorldEditorModal', () => {
    const mockMutate = vi.fn();

    beforeEach(() => {
        (ChimeraApi.useCreateWorld as any).mockReturnValue({
            mutateAsync: mockMutate,
            isPending: false
        });
        mockMutate.mockClear();
    });

    it('renders when open', () => {
        render(<WorldEditorModal open={true} onOpenChange={vi.fn()} />);
        expect(screen.getByText('Create World')).toBeInTheDocument();
        expect(screen.getByLabelText('World Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Summary')).toBeInTheDocument();
    });

    it('calls create mutation on save with all fields', async () => {
        render(<WorldEditorModal open={true} onOpenChange={vi.fn()} />);

        // Fill form
        fireEvent.change(screen.getByLabelText('World Name'), { target: { value: 'New World' } });
        fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'A short summary' } });
        fireEvent.change(screen.getByLabelText('Full Description'), { target: { value: 'A very long description.' } });

        // Click Save
        fireEvent.click(screen.getByText('Save Draft'));

        expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
            display_name: 'New World',
            description_short: 'A short summary',
            description_long: 'A very long description.',
            status: 'draft'
        }));
    });
});
