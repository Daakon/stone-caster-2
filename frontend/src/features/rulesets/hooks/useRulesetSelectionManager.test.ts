import { renderHook, act } from '@testing-library/react';
import { useRulesetSelectionManager } from './useRulesetSelectionManager';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useRulesets, fetchGenrePreset } from '@/services/chimera-api';

// Mock dependencies
vi.mock('@/services/chimera-api', () => ({
    useRulesets: vi.fn(),
    fetchGenrePreset: vi.fn(),
}));

const mockRulesets = [
    { id: 'foundation-1', key: 'foundation-1', name: 'Foundation 1', dependencies: [], exclusion_group: 'group-a', ui_category: 'foundation' },
    { id: 'foundation-2', key: 'foundation-2', name: 'Foundation 2', dependencies: [], exclusion_group: 'group-a', ui_category: 'foundation' },
    { id: 'expansion-1.1', key: 'expansion-1.1', name: 'Expansion 1.1', dependencies: ['foundation-1'], exclusion_group: 'none', ui_category: 'expansion' },
    { id: 'expansion-1.2', key: 'expansion-1.2', name: 'Expansion 1.2', dependencies: ['expansion-1.1'], exclusion_group: 'none', ui_category: 'expansion' },
];

describe('useRulesetSelectionManager', () => {
    beforeEach(() => {
        (useRulesets as Mock).mockReturnValue({
            data: mockRulesets
        });
    });

    it('should initialize with initialSelectedKeys', () => {
        const { result } = renderHook(() => useRulesetSelectionManager({ initialSelectedKeys: ['foundation-1'] }));
        expect(result.current.selectedKeys).toContain('foundation-1');
    });

    it('should select dependencies automatically (Cascade Select)', () => {
        const { result } = renderHook(() => useRulesetSelectionManager({ initialSelectedKeys: [] }));

        act(() => {
            result.current.toggleRuleset('expansion-1.1');
        });

        // Should select expansion-1.1 AND foundation-1
        expect(result.current.selectedKeys).toContain('expansion-1.1');
        expect(result.current.selectedKeys).toContain('foundation-1');
    });

    it('should deselect dependents automatically (Cascade Deselect)', () => {
        const { result } = renderHook(() => useRulesetSelectionManager({
            initialSelectedKeys: ['foundation-1', 'expansion-1.1']
        }));

        act(() => {
            // Mock confirmation dialog to auto-confirm if needed, 
            // but our hook currently sets dialog state. We need to manually confirm.
            // Or we can mock the hook behavior differently. 
            // Ideally we test the logic.
            result.current.toggleRuleset('foundation-1');
        });

        // This triggers confirmation dialog in real app.
        expect(result.current.confirmationDialog.isOpen).toBe(true);

        act(() => {
            result.current.confirmationDialog.onConfirm();
        });

        expect(result.current.selectedKeys).toEqual([]);
    });

    it('should enforce exclusion groups', () => {
        const { result } = renderHook(() => useRulesetSelectionManager({ initialSelectedKeys: ['foundation-1'] }));

        act(() => {
            result.current.toggleRuleset('foundation-2');
        });

        // foundation-1 and foundation-2 are in 'group-a'. Selecting 2 should remove 1.
        expect(result.current.selectedKeys).toContain('foundation-2');
        expect(result.current.selectedKeys).not.toContain('foundation-1');
    });

    it('should apply preset', async () => {
        (fetchGenrePreset as Mock).mockResolvedValue(['foundation-1', 'expansion-1.1']);

        const { result } = renderHook(() => useRulesetSelectionManager({ initialSelectedKeys: [] }));

        await act(async () => {
            await result.current.applyPreset('high-fantasy');
        });

        expect(result.current.selectedKeys).toContain('foundation-1');
        expect(result.current.selectedKeys).toContain('expansion-1.1');
    });

    it('should apply setting preset over genre preset', async () => {
        // First mock: Genre returns foundation-1
        // Second mock: Setting returns foundation-2 (which overrides foundation-1 due to exclusion group)
        (fetchGenrePreset as Mock)
            .mockResolvedValueOnce(['foundation-1'])
            .mockResolvedValueOnce(['foundation-2']);

        const { result } = renderHook(() => useRulesetSelectionManager({ initialSelectedKeys: [] }));

        // Apply Genre
        await act(async () => {
            await result.current.applyPreset('high-fantasy');
        });
        expect(result.current.selectedKeys).toContain('foundation-1');

        // Apply Setting
        await act(async () => {
            await result.current.applyPreset('mystic-forest');
        });

        // Should contain foundation-2
        expect(result.current.selectedKeys).toContain('foundation-2');
        // valid because foundation-1 and foundation-2 are in the same exclusion group 'group-a'
        // wait, the hook logic just sets new keys. It doesn't automatically run exclusion logic on "set", 
        // only on "toggle" usually. 
        // Let's check setSelectedKeys logic in useRulesetSelectionManager. 
        // It simply sets the keys. The user logic might need to ensure exclusions.
        // If applyPreset just sets keys, it might violate exclusions if the preset itself is invalid?
        // But here we rely on the preset being valid.
        // However, if we just overwrite... 
        // "const newKeys = Array.from(new Set([...presetRuleIds, ...lockedKeys]));"
        // It replaces the selection entirely (modulo locked keys). 
        // So yes, foundation-1 is gone, foundation-2 is present.
        expect(result.current.selectedKeys).not.toContain('foundation-1');
    });
});
