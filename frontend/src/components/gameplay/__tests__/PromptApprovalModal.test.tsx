import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PromptApprovalModal } from '../PromptApprovalModal';

const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  onApprove: vi.fn(),
  prompt: 'This is a test prompt for the AI. It contains multiple sentences to test the display functionality.',
  promptId: 'test-prompt-123',
  metadata: {
    worldId: 'test-world',
    characterId: 'test-character',
    turnIndex: 0,
    tokenCount: 25,
  },
  isLoading: false,
};

describe('PromptApprovalModal', () => {
  it('renders when open', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    expect(screen.getByText('AI Prompt Approval Required')).toBeInTheDocument();
    expect(screen.getByText('Prompt Information')).toBeInTheDocument();
    expect(screen.getByText('Generated Prompt')).toBeInTheDocument();
    expect(screen.getByText('Review Instructions')).toBeInTheDocument();
  });

  it('displays prompt metadata correctly', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    expect(screen.getByText('ID: test-prompt-123')).toBeInTheDocument();
    expect(screen.getByText('World: test-world')).toBeInTheDocument();
    expect(screen.getByText('Turn: 0')).toBeInTheDocument();
    expect(screen.getByText('Tokens: ~25')).toBeInTheDocument();
    expect(screen.getByText('Character: test-character')).toBeInTheDocument();
  });

  it('displays the prompt content', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toHaveValue(mockProps.prompt);
    expect(textarea).toHaveAttribute('readonly');
  });

  it('shows truncated prompt by default for long content', () => {
    const longPrompt = 'A'.repeat(1000);
    const propsWithLongPrompt = { ...mockProps, prompt: longPrompt };
    
    render(<PromptApprovalModal {...propsWithLongPrompt} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toHaveLength(503); // 500 + '...'
    expect(screen.getByText(/Showing first 500 characters/)).toBeInTheDocument();
  });

  it('toggles between truncated and full prompt', () => {
    const longPrompt = 'A'.repeat(1000);
    const propsWithLongPrompt = { ...mockProps, prompt: longPrompt };
    
    render(<PromptApprovalModal {...propsWithLongPrompt} />);
    
    // Initially shows truncated
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toHaveLength(503);
    
    // Click "Show Full"
    fireEvent.click(screen.getByText('Show Full'));
    expect(textarea.value).toHaveLength(1000);
    expect(screen.getByText('Show Less')).toBeInTheDocument();
    
    // Click "Show Less"
    fireEvent.click(screen.getByText('Show Less'));
    expect(textarea.value).toHaveLength(503);
    expect(screen.getByText('Show Full')).toBeInTheDocument();
  });

  it('calls onApprove with true when approve button is clicked', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    fireEvent.click(screen.getByText('Approve & Continue'));
    
    expect(mockProps.onApprove).toHaveBeenCalledWith(true);
  });

  it('calls onApprove with false when reject button is clicked', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    fireEvent.click(screen.getByText('Reject'));
    
    expect(mockProps.onApprove).toHaveBeenCalledWith(false);
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('disables buttons when loading', () => {
    const loadingProps = { ...mockProps, isLoading: true };
    render(<PromptApprovalModal {...loadingProps} />);
    
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Reject')).toBeDisabled();
    expect(screen.getByText('Approve & Continue')).toBeDisabled();
  });

  it('handles missing character ID gracefully', () => {
    const propsWithoutCharacter = {
      ...mockProps,
      metadata: {
        ...mockProps.metadata,
        characterId: undefined,
      },
    };
    
    render(<PromptApprovalModal {...propsWithoutCharacter} />);
    
    // Should not show character badge
    expect(screen.queryByText(/Character:/)).not.toBeInTheDocument();
  });

  it('shows review instructions', () => {
    render(<PromptApprovalModal {...mockProps} />);
    
    expect(screen.getByText(/Please review the generated AI prompt/)).toBeInTheDocument();
    expect(screen.getByText(/Check that the prompt includes appropriate context/)).toBeInTheDocument();
    expect(screen.getByText(/Only approve if you're satisfied/)).toBeInTheDocument();
  });
});
