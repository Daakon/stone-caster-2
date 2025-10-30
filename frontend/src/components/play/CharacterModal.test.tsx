import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CharacterModal from './CharacterModal';
import * as analytics from '@/lib/analytics';

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  trackCharacterCreate: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('CharacterModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockCreateCharacter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with form fields', () => {
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        createCharacter={mockCreateCharacter}
        isPending={false}
      />
    );

    expect(screen.getByText('Create New Character')).toBeInTheDocument();
    expect(screen.getByLabelText('Character Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Portrait Seed (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Character')).toBeInTheDocument();
  });

  it('validates required name field', async () => {
    const mockOnSave = vi.fn();
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={mockOnSave}
      />
    );

    // Submit the form without filling in the name
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Character name is required')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('validates name length', async () => {
    const mockOnSave = vi.fn();
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByLabelText('Character Name *');
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(51) } });
    
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Character name must be less than 50 characters')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('validates portrait seed length', async () => {
    const mockOnSave = vi.fn();
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByLabelText('Character Name *');
    const seedInput = screen.getByLabelText('Portrait Seed (Optional)');
    
    fireEvent.change(nameInput, { target: { value: 'Test Character' } });
    fireEvent.change(seedInput, { target: { value: 'a'.repeat(101) } });
    
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Portrait seed must be 100 characters or less')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByLabelText('Character Name *');
    const seedInput = screen.getByLabelText('Portrait Seed (Optional)');
    
    fireEvent.change(nameInput, { target: { value: 'Test Character' } });
    fireEvent.change(seedInput, { target: { value: 'test-seed' } });
    
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Test Character',
        portrait_seed: 'test-seed',
      });
    });
  });

  it('submits form without portrait seed', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isLoading={false}
      />
    );

    const nameInput = screen.getByLabelText('Character Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Character' } });
    
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Test Character',
        portrait_seed: undefined,
      });
    });
  });

  it('handles creation error', async () => {
    const mockOnSave = vi.fn().mockRejectedValue(new Error('Creation failed'));

    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isLoading={false}
      />
    );

    const nameInput = screen.getByLabelText('Character Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Character' } });
    
    const form = screen.getByRole('form') || document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Test Character',
        portrait_seed: undefined,
      });
    });
  });

  it('closes modal on cancel', () => {
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={vi.fn()}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal on escape key', () => {
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={vi.fn()}
        isLoading={false}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state when pending', () => {
    renderWithProviders(
      <CharacterModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <CharacterModal
        isOpen={false}
        onClose={mockOnClose}
        onSave={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.queryByText('Create New Character')).not.toBeInTheDocument();
  });
});
