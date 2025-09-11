/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GAD7Assessment from '@/components/assessments/GAD7Assessment';

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

describe('GAD-7 Assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders first question', () => {
    render(<GAD7Assessment />);
    
    expect(screen.getByText(/Feeling nervous, anxious, or on edge/i)).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 7')).toBeInTheDocument();
  });

  it('calculates score correctly for minimal anxiety', async () => {
    const onComplete = jest.fn();
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer all questions with "Not at all" (0 points each)
    for (let i = 0; i < 7; i++) {
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
      
      // Wait for auto-advance except on last question
      if (i < 6) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('0/21')).toBeInTheDocument();
      expect(screen.getByText('Minimal Anxiety')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(0, 'Minimal');
  });

  it('calculates score correctly for mild anxiety', async () => {
    const onComplete = jest.fn();
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer to get a score of 6 (mild)
    // First 6 questions: "Several days" (1 point each)
    for (let i = 0; i < 6; i++) {
      const severalDaysButton = screen.getByText('Several days');
      fireEvent.click(severalDaysButton);
      
      if (i < 5) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // Last question: "Not at all" (0 points)
    await waitFor(() => {
      expect(screen.getByText('Question 7 of 7')).toBeInTheDocument();
    });
    
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('6/21')).toBeInTheDocument();
      expect(screen.getByText('Mild Anxiety')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(6, 'Mild');
  });

  it('calculates score correctly for moderate anxiety', async () => {
    const onComplete = jest.fn();
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer to get a score of 12 (moderate)
    // All 7 questions with mixed scores to total 12
    const answers = [
      'More than half the days', // 2 points
      'More than half the days', // 2 points
      'More than half the days', // 2 points
      'More than half the days', // 2 points
      'More than half the days', // 2 points
      'Several days',            // 1 point
      'Several days'             // 1 point
    ];
    
    for (let i = 0; i < answers.length; i++) {
      const button = screen.getByText(answers[i]);
      fireEvent.click(button);
      
      if (i < answers.length - 1) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('12/21')).toBeInTheDocument();
      expect(screen.getByText('Moderate Anxiety')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(12, 'Moderate');
  });

  it('triggers crisis alert for severe anxiety (score >= 15)', async () => {
    const { apiClient } = require('@/lib/api-client');
    const { toast } = require('sonner');
    const onComplete = jest.fn();
    
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer to get a score of 18 (severe)
    // First 6 questions: "Nearly every day" (3 points each) = 18 points
    for (let i = 0; i < 6; i++) {
      const nearlyEveryDayButton = screen.getByText('Nearly every day');
      fireEvent.click(nearlyEveryDayButton);
      
      if (i < 5) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // Last question: "Not at all" (0 points)
    await waitFor(() => {
      expect(screen.getByText('Question 7 of 7')).toBeInTheDocument();
    });
    
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('18/21')).toBeInTheDocument();
      expect(screen.getByText('Severe Anxiety')).toBeInTheDocument();
    });
    
    // Verify crisis alert was triggered
    expect(apiClient.triggerCrisis).toHaveBeenCalledWith({
      message: 'High GAD-7 score detected',
      severity: 'high',
      assessmentScore: 18
    });
    
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Your anxiety level indicates you may need immediate support'),
      expect.objectContaining({ duration: 10000 })
    );
    
    expect(onComplete).toHaveBeenCalledWith(18, 'Severe');
  });

  it('validates all questions are answered before submission', async () => {
    render(<GAD7Assessment />);
    
    // Navigate through questions without answering
    for (let i = 0; i < 6; i++) {
      const nextButton = screen.getByText('Next');
      // Next button should be disabled without answering
      expect(nextButton).toBeDisabled();
      
      // Answer the question to enable next
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
      
      // Now we should auto-advance
      if (i < 5) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // On last question, submit button should be disabled until answered
    await waitFor(() => {
      expect(screen.getByText('Question 7 of 7')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer last question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Now submit button should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('shows progress as user answers questions', async () => {
    render(<GAD7Assessment />);
    
    // Initially shows question 1 of 7
    expect(screen.getByText('Question 1 of 7')).toBeInTheDocument();
    expect(screen.getByText('14%')).toBeInTheDocument(); // Progress percentage
    
    // Answer first question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Auto-advances to next question
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 7')).toBeInTheDocument();
      expect(screen.getByText('29%')).toBeInTheDocument();
    });
  });

  it('allows navigation between questions', async () => {
    render(<GAD7Assessment />);
    
    // Answer first question
    const notAtAllButton = screen.getByText('Not at all');
    fireEvent.click(notAtAllButton);
    
    // Wait for auto-advance
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 7')).toBeInTheDocument();
    });
    
    // Navigate back
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
    
    expect(screen.getByText('Question 1 of 7')).toBeInTheDocument();
    
    // Navigate forward
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    expect(screen.getByText('Question 2 of 7')).toBeInTheDocument();
  });

  it('converts GAD-7 score to anxiety scale for check-in', async () => {
    const { apiClient } = require('@/lib/api-client');
    const onComplete = jest.fn();
    
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer to get a score of 15
    // 5 questions with "Nearly every day" (3 points each) = 15 points
    for (let i = 0; i < 5; i++) {
      const nearlyEveryDayButton = screen.getByText('Nearly every day');
      fireEvent.click(nearlyEveryDayButton);
      
      if (i < 4) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 7`)).toBeInTheDocument();
        });
      }
    }
    
    // Remaining 2 questions: "Not at all" (0 points)
    for (let i = 5; i < 7; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 7`)).toBeInTheDocument();
      });
      
      const notAtAllButton = screen.getByText('Not at all');
      fireEvent.click(notAtAllButton);
    }
    
    // Submit
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(apiClient.submitCheckIn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GAD-7',
          score: 15,
          severity: 'Severe',
          anxiety: 7, // Math.min(10, Math.round(15 / 2.1))
          assessmentType: 'GAD-7',
          assessmentScore: 15
        })
      );
    });
    
    expect(onComplete).toHaveBeenCalledWith(15, 'Severe');
  });
});