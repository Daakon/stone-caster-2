import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StoriesFilterBar } from './StoriesFilterBar';

// Mock the queries
vi.mock('@/lib/queries', () => ({
  useWorldsQuery: () => ({
    data: [
      { id: 'world-1', name: 'Mystika' },
      { id: 'world-2', name: 'Cyberpunk' }
    ]
  }),
  useRulesetsQuery: () => ({
    data: [
      { id: 'ruleset-1', name: 'D&D 5e' },
      { id: 'ruleset-2', name: 'Pathfinder' }
    ]
  })
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  trackFilterChange: vi.fn()
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('StoriesFilterBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all filter controls', () => {
    renderWithRouter(<StoriesFilterBar />);
    
    expect(screen.getByLabelText('Search stories')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
    expect(screen.getByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('Ruleset')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('should update search query', async () => {
    renderWithRouter(<StoriesFilterBar />);
    
    const searchInput = screen.getByLabelText('Search stories');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('test query');
    });
  });

  it('should show clear filters button when filters are active', async () => {
    renderWithRouter(<StoriesFilterBar />);
    
    const searchInput = screen.getByLabelText('Search stories');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  it('should add tags when Enter is pressed', async () => {
    renderWithRouter(<StoriesFilterBar />);
    
    const addTagButton = screen.getByLabelText('Add tag');
    fireEvent.click(addTagButton);
    
    const tagInput = screen.getByPlaceholderText('Enter tag...');
    fireEvent.change(tagInput, { target: { value: 'romance' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByText('romance')).toBeInTheDocument();
    });
  });

  it('should remove tags when X is clicked', async () => {
    renderWithRouter(<StoriesFilterBar />);
    
    // Add a tag first
    const addTagButton = screen.getByLabelText('Add tag');
    fireEvent.click(addTagButton);
    
    const tagInput = screen.getByPlaceholderText('Enter tag...');
    fireEvent.change(tagInput, { target: { value: 'romance' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByText('romance')).toBeInTheDocument();
    });
    
    // Remove the tag
    const removeButton = screen.getByLabelText('Remove romance tag');
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(screen.queryByText('romance')).not.toBeInTheDocument();
    });
  });

  it('should populate world options from API', () => {
    renderWithRouter(<StoriesFilterBar />);
    
    const worldSelect = screen.getByRole('combobox', { name: /world/i });
    fireEvent.click(worldSelect);
    
    expect(screen.getByText('Mystika')).toBeInTheDocument();
    expect(screen.getByText('Cyberpunk')).toBeInTheDocument();
  });

  it('should populate ruleset options from API', () => {
    renderWithRouter(<StoriesFilterBar />);
    
    const rulesetSelect = screen.getByRole('combobox', { name: /ruleset/i });
    fireEvent.click(rulesetSelect);
    
    expect(screen.getByText('D&D 5e')).toBeInTheDocument();
    expect(screen.getByText('Pathfinder')).toBeInTheDocument();
  });
});
