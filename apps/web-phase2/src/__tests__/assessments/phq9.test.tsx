import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PHQ9Assessment from '@/components/assessments/PHQ9Assessment';

// Mock the dependencies
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    submitCheckIn: jest.fn().mockResolvedValue({ success: true }),
    triggerCrisis: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('@/store/useStore', () => ({
  useStore: () => ({
    user: { id: 'test-user', email: 'test@example.com' }
  })
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

describe('PHQ-9 Assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders first question', () => {
    render(<PHQ9Assessment />);
    
    expect(screen.getByText(/Little interest or pleasure in doing things/i)).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 9')).toBeInTheDocument();
  });

  it('calculates score correctly for minimal depression', async () => {
    const onComplete = jest.fn();
    render(<PHQ9Assessment onComplete={onComplete} />);
    
    // Answer all questions with "Not at all" (0 points each)
    for (let i = 0; i < 9; i++) {
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
      
      // Wait for auto-advance except on last question
      if (i < 8) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 9`)).toBeInTheDocument();
        });
      }
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('0/27')).toBeInTheDocument();
      expect(screen.getByText('Minimal Depression')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(0, 'Minimal');
  });

  it('triggers crisis alert for severe depression (score >= 20)', async () => {
    const onComplete = jest.fn();
    const { toast } = require('sonner');
    
    render(<PHQ9Assessment onComplete={onComplete} />);
    
    // Answer to get a score of 27 (maximum - severe)
    // Select "Nearly every day" (3 points) for all 9 questions
    for (let i = 0; i < 9; i++) {
      const nearlyEveryDayButton = screen.getByText('Nearly every day');
      fireEvent.click(nearlyEveryDayButton);
      
      // Wait for auto-advance except on last question
      if (i < 8) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 9`)).toBeInTheDocument();
        });
      }
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('27/27')).toBeInTheDocument();
      expect(screen.getByText('Severe Depression')).toBeInTheDocument();
    });
    
    // Verify onComplete was called with correct score and severity
    expect(onComplete).toHaveBeenCalledWith(27, 'Severe');
    
    // Question 9 is about suicidal thoughts - if answered with > 0, should show crisis message
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Your response indicates you may need immediate support'),
      expect.objectContaining({ duration: 10000 })
    );
  });

  it('validates all questions are answered before submission', async () => {
    render(<PHQ9Assessment />);
    
    // Try to go to next without answering - should be disabled
    let nextButton = screen.queryByText('Next');
    if (nextButton) {
      expect(nextButton).toBeDisabled();
    }
    
    // Navigate through all questions, answering each
    for (let i = 0; i < 8; i++) {
      // Answer the current question
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
      
      // Should auto-advance to next question
      if (i < 7) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 9`)).toBeInTheDocument();
        });
      }
    }
    
    // Now on question 9
    await waitFor(() => {
      expect(screen.getByText('Question 9 of 9')).toBeInTheDocument();
    });
    
    // Submit button should be disabled until last question is answered
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer last question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Now submit button should be enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows progress as user answers questions', async () => {
    render(<PHQ9Assessment />);
    
    // Initially shows question 1 of 9
    expect(screen.getByText('Question 1 of 9')).toBeInTheDocument();
    expect(screen.getByText('11%')).toBeInTheDocument(); // Progress percentage
    
    // Answer first question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Auto-advances to next question
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 9')).toBeInTheDocument();
      expect(screen.getByText('22%')).toBeInTheDocument();
    });
  });

  it('allows navigation between questions', async () => {
    render(<PHQ9Assessment />);
    
    // Answer first question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Wait for auto-advance
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 9')).toBeInTheDocument();
    });
    
    // Navigate back
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
    
    expect(screen.getByText('Question 1 of 9')).toBeInTheDocument();
    
    // Navigate forward (should still have answer selected)
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    expect(screen.getByText('Question 2 of 9')).toBeInTheDocument();
  });
});