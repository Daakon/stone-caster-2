import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SessionPage from './SessionPage';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual<any>('@tanstack/react-query');
	return {
		...actual,
		useQuery: vi.fn((opts) => ({ isLoading: true })),
	};
});

const mockUseQuery = (vi.mocked as any)(await import('@tanstack/react-query')).useQuery as any;

describe('SessionPage', () => {
	it('renders skeletons initially', () => {
		render(
			<MemoryRouter initialEntries={["/play/session/s-1"]}>
				<Routes>
					<Route path="/play/session/:id" element={<SessionPage />} />
				</Routes>
			</MemoryRouter>
		);
		expect(screen.getAllByRole('generic', { hidden: true }).length).toBeGreaterThan(1);
	});

	it('focuses chat heading after load and hotkey focuses input', async () => {
		mockUseQuery.mockImplementation(({ queryKey }: any) => {
			if (String(queryKey[1]).startsWith('s-')) {
				return { isLoading: false, data: { data: { id: 's-1', title: 'T', character_name: 'C' } } };
			}
			return { isLoading: false, data: { data: [{ id: 'm1', role: 'assistant', content: 'Hello', created_at: '' }] } };
		});

		render(
			<MemoryRouter initialEntries={["/play/session/s-1"]}>
				<Routes>
					<Route path="/play/session/:id" element={<SessionPage />} />
				</Routes>
			</MemoryRouter>
		);

		await act(async () => {});
		const heading = screen.getByRole('heading', { name: 'Chat' });
		expect(document.activeElement).toBe(heading);

		// hotkey
		await act(async () => {
			const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
			window.dispatchEvent(evt);
		});
		const input = screen.getByRole('textbox', { name: /message input/i });
		expect(document.activeElement).toBe(input);
	});
});





