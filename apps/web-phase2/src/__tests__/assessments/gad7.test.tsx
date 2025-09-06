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

  it('renders all 7 questions', () => {
    render(<GAD7Assessment />);
    
    expect(screen.getByText(/Feeling nervous, anxious, or on edge/i)).toBeInTheDocument();
    expect(screen.getByText(/Not being able to stop or control worrying/i)).toBeInTheDocument();
    expect(screen.getByText(/Worrying too much about different things/i)).toBeInTheDocument();
    expect(screen.getByText(/Trouble relaxing/i)).toBeInTheDocument();
    expect(screen.getByText(/Being so restless that it is hard to sit still/i)).toBeInTheDocument();
    expect(screen.getByText(/Becoming easily annoyed or irritable/i)).toBeInTheDocument();
    expect(screen.getByText(/Feeling afraid, as if something awful might happen/i)).toBeInTheDocument();
  });

  it('calculates score correctly for minimal anxiety', async () => {
    const onComplete = jest.fn();
    render(<GAD7Assessment onComplete={onComplete} />);
    
    // Answer all questions with "Not at all" (0 points each)
    const notAtAllButtons = screen.getAllByText('Not at all');
    for (const button of notAtAllButtons) {
      fireEvent.click(button);
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
    // Select "Several days" (1 point) for first 6 questions
    for (let i = 0; i < 6; i++) {
      const severalDaysButtons = screen.getAllByText('Several days');
      fireEvent.click(severalDaysButtons[i]);
    }
    
    // Select "Not at all" (0 points) for last question
    const notAtAllButtons = screen.getAllByText('Not at all');
    fireEvent.click(notAtAllButtons[6]);
    
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
    // Select "More than half the days" (2 points) for first 6 questions
    for (let i = 0; i < 6; i++) {
      const moreThanHalfButtons = screen.getAllByText('More than half the days');
      fireEvent.click(moreThanHalfButtons[i]);
    }
    
    // Select "Not at all" (0 points) for last question
    const notAtAllButtons = screen.getAllByText('Not at all');
    fireEvent.click(notAtAllButtons[6]);
    
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
    
    render(<GAD7Assessment />);
    
    // Answer to get a score of 18 (severe)
    const nearlyEveryDayButtons = screen.getAllByText('Nearly every day');
    
    // Select "Nearly every day" (3 points) for 6 questions = 18 points
    for (let i = 0; i < 6; i++) {
      fireEvent.click(nearlyEveryDayButtons[i]);
    }
    
    // Select "Not at all" for last question
    const notAtAllButtons = screen.getAllByText('Not at all');
    fireEvent.click(notAtAllButtons[6]);
    
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
  });

  it('validates all questions are answered before submission', () => {
    render(<GAD7Assessment />);
    
    // Try to submit without answering questions
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer only first question
    const firstQuestionButtons = screen.getAllByText('Not at all');
    fireEvent.click(firstQuestionButtons[0]);
    
    // Submit button should still be disabled
    expect(submitButton).toBeDisabled();
    
    // Answer all questions
    const notAtAllButtons = screen.getAllByText('Not at all');
    for (const button of notAtAllButtons) {
      fireEvent.click(button);
    }
    
    // Now submit button should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('shows progress as user answers questions', () => {
    render(<GAD7Assessment />);
    
    // Initially shows question 1 of 7
    expect(screen.getByText('Question 1 of 7')).toBeInTheDocument();
    expect(screen.getByText('14%')).toBeInTheDocument(); // Progress percentage
    
    // Answer first question
    const notAtAllButton = screen.getAllByText('Not at all')[0];
    fireEvent.click(notAtAllButton);
    
    // Auto-advances to next question
    setTimeout(() => {
      expect(screen.getByText('Question 2 of 7')).toBeInTheDocument();
      expect(screen.getByText('29%')).toBeInTheDocument();
    }, 400);
  });

  it('allows navigation between questions', async () => {
    render(<GAD7Assessment />);
    
    // Answer first question
    const notAtAllButton = screen.getAllByText('Not at all')[0];
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

  it('displays severity levels correctly', async () => {
    const testCases = [
      { score: 0, severity: 'Minimal' },
      { score: 5, severity: 'Mild' },
      { score: 10, severity: 'Moderate' },
      { score: 15, severity: 'Severe' }
    ];
    
    for (const testCase of testCases) {
      const { unmount } = render(<GAD7Assessment />);
      
      // Answer questions to achieve target score
      let currentScore = 0;
      let questionIndex = 0;
      
      while (currentScore < testCase.score && questionIndex < 7) {
        const pointsNeeded = testCase.score - currentScore;
        const pointsToAdd = Math.min(3, pointsNeeded);
        
        // Find button for this point value
        const optionButtons = screen.getAllByText(
          pointsToAdd === 0 ? 'Not at all' :
          pointsToAdd === 1 ? 'Several days' :
          pointsToAdd === 2 ? 'More than half the days' :
          'Nearly every day'
        );
        
        fireEvent.click(optionButtons[questionIndex]);
        currentScore += pointsToAdd;
        questionIndex++;
      }
      
      // Fill remaining questions with 0
      while (questionIndex < 7) {
        const notAtAllButtons = screen.getAllByText('Not at all');
        fireEvent.click(notAtAllButtons[questionIndex]);
        questionIndex++;
      }
      
      // Submit
      fireEvent.click(screen.getByText('Submit Assessment'));
      
      await waitFor(() => {
        expect(screen.getByText(`${testCase.severity} Anxiety`)).toBeInTheDocument();
      });
      
      unmount(); // Clean up for next test
    }
  });

  it('converts GAD-7 score to anxiety scale for check-in', async () => {
    const { apiClient } = require('@/lib/api-client');
    
    render(<GAD7Assessment />);
    
    // Answer to get a score of 15
    const nearlyEveryDayButtons = screen.getAllByText('Nearly every day');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(nearlyEveryDayButtons[i]);
    }
    
    const notAtAllButtons = screen.getAllByText('Not at all');
    for (let i = 5; i < 7; i++) {
      fireEvent.click(notAtAllButtons[i]);
    }
    
    // Submit
    fireEvent.click(screen.getByText('Submit Assessment'));
    
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
  });
});