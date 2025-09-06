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
    
    expect(onComplete).toHaveBeenCalledWith(0, 'Minimal Depression');
  });

  it('triggers crisis alert for severe depression (score >= 20)', async () => {
    const { apiClient } = require('@/lib/api-client');
    const { toast } = require('sonner');
    
    render(<PHQ9Assessment />);
    
    // Answer to get a score of 24 (severe)
    // Select "Nearly every day" (3 points) for 8 questions = 24 points
    for (let i = 0; i < 8; i++) {
      const nearlyEveryDayButton = screen.getByText('Nearly every day');
      fireEvent.click(nearlyEveryDayButton);
      
      // Wait for auto-advance
      if (i < 7) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 9`)).toBeInTheDocument();
        });
      }
    }
    
    // Last question: "Not at all" (0 points)
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('24/27')).toBeInTheDocument();
      expect(screen.getByText('Severe Depression')).toBeInTheDocument();
    });
    
    // Verify crisis alert was triggered
    expect(apiClient.triggerCrisis).toHaveBeenCalledWith({
      message: 'High PHQ-9 score detected',
      severity: 'high',
      assessmentScore: 24
    });
    
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Your assessment indicates severe depression'),
      expect.objectContaining({ duration: 10000 })
    );
  });

  it('validates all questions are answered before submission', async () => {
    render(<PHQ9Assessment />);
    
    // Navigate to last question without answering
    for (let i = 0; i < 8; i++) {
      const nextButton = screen.getByText('Next');
      // Next button should be disabled without answering
      expect(nextButton).toBeDisabled();
      
      // Answer the question to enable next
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
      
      // Now next button should be enabled
      if (i < 7) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 9`)).toBeInTheDocument();
        });
      }
    }
    
    // On last question, submit button should be disabled until answered
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer last question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Now submit button should be enabled
    expect(submitButton).not.toBeDisabled();
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