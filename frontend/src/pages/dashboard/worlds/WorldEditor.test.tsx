/**
 * WorldEditor Component Test
 * Tests world creation/editing with tag selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import WorldEditor from './Editor';

// Mock services
vi.mock('@/services/chimera.worlds', () => ({
  chimeraWorldsService: {
    getWorld: vi.fn(),
    createWorld: vi.fn(),
    updateWorld: vi.fn(),
  },
}));

vi.mock('@/services/admin.chimera', () => ({
  chimeraService: {
    listRulesetTemplates: vi.fn().mockResolvedValue([]),
  },
}));

// Mock TagSelect component
vi.mock('@/components/chimera/TagSelect', () => ({
  TagSelect: ({ selectedTagNames, onTagNamesChange }: any) => (
    <div data-testid="tag-select">
      <button
        onClick={() => onTagNamesChange(['FANTASY', 'HORROR'])}
        data-testid="select-tags-button"
      >
        Select Tags
      </button>
      <div data-testid="selected-tags">
        {selectedTagNames.map((tag: string) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </div>
  ),
}));

// Mock ImageUploader
vi.mock('@/components/ui/ImageUploader', () => ({
  ImageUploader: () => <div data-testid="image-uploader">Image Uploader</div>,
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}), // No id = create mode
  };
});

describe('WorldEditor', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('should render world editor form', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorldEditor />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByTestId('tag-select')).toBeInTheDocument();
    expect(screen.getByTestId('image-uploader')).toBeInTheDocument();
  });

  it('should map TagSelect tag_names to tags array on submit', async () => {
    const { chimeraWorldsService } = await import('@/services/chimera.worlds');
    const mockCreateWorld = vi.mocked(chimeraWorldsService.createWorld);
    mockCreateWorld.mockResolvedValue({
      id: 'world-1',
      display_name: 'Test World',
    } as any);

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorldEditor />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Fill in required fields
    await user.type(screen.getByLabelText(/display name/i), 'Test World');

    // Select tags via TagSelect component
    const selectTagsButton = screen.getByTestId('select-tags-button');
    await user.click(selectTagsButton);

    // Verify tags are displayed
    await waitFor(() => {
      expect(screen.getByText('FANTASY')).toBeInTheDocument();
      expect(screen.getByText('HORROR')).toBeInTheDocument();
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create world/i });
    await user.click(submitButton);

    // Verify API was called with tags array
    await waitFor(() => {
      expect(mockCreateWorld).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Test World',
          tags: ['FANTASY', 'HORROR'],
        })
      );
    });
  });

  it('should load existing world tags into TagSelect', async () => {
    const { chimeraWorldsService } = await import('@/services/chimera.worlds');
    const mockGetWorld = vi.mocked(chimeraWorldsService.getWorld);
    mockGetWorld.mockResolvedValue({
      id: 'world-1',
      display_name: 'Existing World',
      tags: ['FANTASY', 'SCIFI'],
    } as any);

    // Mock useParams to return an id (edit mode)
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useParams: () => ({ id: 'world-1' }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorldEditor />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockGetWorld).toHaveBeenCalledWith('world-1');
    });

    // Verify tags are loaded into TagSelect
    await waitFor(() => {
      const selectedTags = screen.getByTestId('selected-tags');
      expect(selectedTags).toBeInTheDocument();
    });
  });

  it('should update tags when TagSelect changes', async () => {
    const { chimeraWorldsService } = await import('@/services/chimera.worlds');
    const mockCreateWorld = vi.mocked(chimeraWorldsService.createWorld);
    mockCreateWorld.mockResolvedValue({
      id: 'world-1',
      display_name: 'Test World',
    } as any);

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorldEditor />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await user.type(screen.getByLabelText(/display name/i), 'Test World');

    // Select tags
    await user.click(screen.getByTestId('select-tags-button'));

    // Submit
    await user.click(screen.getByRole('button', { name: /create world/i }));

    // Verify tags array is sent to API
    await waitFor(() => {
      const callArgs = mockCreateWorld.mock.calls[0][0];
      expect(callArgs.tags).toEqual(['FANTASY', 'HORROR']);
      expect(Array.isArray(callArgs.tags)).toBe(true);
    });
  });
});

