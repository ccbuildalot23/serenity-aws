import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AUDITAssessment from '@/components/assessments/AUDITAssessment';

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

describe('AUDIT Assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 10 questions', () => {
    render(<AUDITAssessment />);
    
    expect(screen.getByText(/How often do you have a drink containing alcohol/i)).toBeInTheDocument();
    expect(screen.getByText(/How many drinks containing alcohol do you have/i)).toBeInTheDocument();
    expect(screen.getByText(/How often do you have six or more drinks/i)).toBeInTheDocument();
    expect(screen.getByText(/not able to stop drinking once you had started/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to do what was normally expected/i)).toBeInTheDocument();
    expect(screen.getByText(/needed a first drink in the morning/i)).toBeInTheDocument();
    expect(screen.getByText(/feeling of guilt or remorse after drinking/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to remember what happened/i)).toBeInTheDocument();
    expect(screen.getByText(/Have you or someone else been injured/i)).toBeInTheDocument();
    expect(screen.getByText(/Has a relative, friend, doctor/i)).toBeInTheDocument();
  });

  it('calculates score correctly for low risk', async () => {
    const onComplete = jest.fn();
    render(<AUDITAssessment onComplete={onComplete} />);
    
    // Answer all questions with lowest score options
    // Question 1: "Never" (0 points)
    fireEvent.click(screen.getByText('Never'));
    
    // Question 2: "1 or 2" (0 points)
    fireEvent.click(screen.getByText('1 or 2'));
    
    // Questions 3-8: "Never" (0 points each)
    for (let i = 0; i < 6; i++) {
      const neverButtons = screen.getAllByText('Never');
      fireEvent.click(neverButtons[i]);
    }
    
    // Questions 9-10: "No" (0 points)
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('0/40')).toBeInTheDocument();
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(0, 'Low Risk');
  });

  it('calculates score correctly for increased risk', async () => {
    const onComplete = jest.fn();
    render(<AUDITAssessment onComplete={onComplete} />);
    
    // Answer to get a score of 10 (increased risk)
    // Question 1: "2-4 times a month" (2 points)
    fireEvent.click(screen.getByText('2-4 times a month'));
    
    // Question 2: "5 or 6" (2 points)
    fireEvent.click(screen.getByText('5 or 6'));
    
    // Question 3: "Monthly" (2 points)
    const monthlyButtons = screen.getAllByText('Monthly');
    fireEvent.click(monthlyButtons[0]);
    
    // Questions 4-7: "Less than monthly" (1 point each = 4 points)
    for (let i = 0; i < 4; i++) {
      const lessThanMonthlyButtons = screen.getAllByText('Less than monthly');
      fireEvent.click(lessThanMonthlyButtons[i]);
    }
    
    // Question 8: "Never" (0 points)
    const neverButtons = screen.getAllByText('Never');
    fireEvent.click(neverButtons[0]);
    
    // Questions 9-10: "No" (0 points)
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('10/40')).toBeInTheDocument();
      expect(screen.getByText('Increased Risk')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(10, 'Increased Risk');
  });

  it('calculates score correctly for high risk', async () => {
    const onComplete = jest.fn();
    render(<AUDITAssessment onComplete={onComplete} />);
    
    // Answer to get a score of 18 (high risk)
    // Question 1: "2-3 times a week" (3 points)
    fireEvent.click(screen.getByText('2-3 times a week'));
    
    // Question 2: "7 to 9" (3 points)
    fireEvent.click(screen.getByText('7 to 9'));
    
    // Questions 3-4: "Weekly" (3 points each = 6 points)
    const weeklyButtons = screen.getAllByText('Weekly');
    fireEvent.click(weeklyButtons[0]);
    fireEvent.click(weeklyButtons[1]);
    
    // Questions 5-7: "Monthly" (2 points each = 6 points)
    for (let i = 0; i < 3; i++) {
      const monthlyButtons = screen.getAllByText('Monthly');
      fireEvent.click(monthlyButtons[i]);
    }
    
    // Question 8: "Never" (0 points)
    const neverButtons = screen.getAllByText('Never');
    fireEvent.click(neverButtons[0]);
    
    // Questions 9-10: "No" (0 points)
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('18/40')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });
    
    expect(onComplete).toHaveBeenCalledWith(18, 'High Risk');
  });

  it('triggers crisis alert for possible dependence (score >= 20)', async () => {
    const { apiClient } = require('@/lib/api-client');
    const { toast } = require('sonner');
    
    render(<AUDITAssessment />);
    
    // Answer to get a score of 24 (possible dependence)
    // Question 1: "4 or more times a week" (4 points)
    fireEvent.click(screen.getByText('4 or more times a week'));
    
    // Question 2: "10 or more" (4 points)
    fireEvent.click(screen.getByText('10 or more'));
    
    // Questions 3-6: "Daily or almost daily" (4 points each = 16 points)
    for (let i = 0; i < 4; i++) {
      const dailyButtons = screen.getAllByText('Daily or almost daily');
      fireEvent.click(dailyButtons[i]);
    }
    
    // Questions 7-8: "Never" (0 points)
    for (let i = 0; i < 2; i++) {
      const neverButtons = screen.getAllByText('Never');
      fireEvent.click(neverButtons[i]);
    }
    
    // Questions 9-10: "No" (0 points)
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Submit assessment
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('24/40')).toBeInTheDocument();
      expect(screen.getByText('Possible Dependence')).toBeInTheDocument();
    });
    
    // Verify crisis alert was triggered
    expect(apiClient.triggerCrisis).toHaveBeenCalledWith({
      message: 'High AUDIT score detected - possible dependence',
      severity: 'high',
      assessmentScore: 24
    });
    
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Your assessment indicates possible alcohol dependence'),
      expect.objectContaining({ duration: 10000 })
    );
  });

  it('validates all questions are answered before submission', () => {
    render(<AUDITAssessment />);
    
    // Try to submit without answering questions
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer only first question
    fireEvent.click(screen.getByText('Never'));
    
    // Submit button should still be disabled
    expect(submitButton).toBeDisabled();
    
    // Answer all questions
    fireEvent.click(screen.getByText('1 or 2'));
    
    for (let i = 0; i < 6; i++) {
      const neverButtons = screen.getAllByText('Never');
      fireEvent.click(neverButtons[i]);
    }
    
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Now submit button should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('shows progress as user answers questions', () => {
    render(<AUDITAssessment />);
    
    // Initially shows question 1 of 10
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument(); // Progress percentage
    
    // Answer first question
    fireEvent.click(screen.getByText('Never'));
    
    // Auto-advances to next question
    setTimeout(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    }, 400);
  });

  it('allows navigation between questions', async () => {
    render(<AUDITAssessment />);
    
    // Answer first question
    fireEvent.click(screen.getByText('Never'));
    
    // Wait for auto-advance
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    });
    
    // Navigate back
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
    
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    
    // Navigate forward
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
  });

  it('handles special scoring for questions 9 and 10', async () => {
    render(<AUDITAssessment />);
    
    // Answer first question
    fireEvent.click(screen.getByText('Never'));
    
    // Answer question 2
    fireEvent.click(screen.getByText('1 or 2'));
    
    // Answer questions 3-8 with "Never" (0 points)
    for (let i = 0; i < 6; i++) {
      const neverButtons = screen.getAllByText('Never');
      fireEvent.click(neverButtons[i]);
    }
    
    // Question 9: "Yes, during the last year" (4 points)
    const yesLastYearButtons = screen.getAllByText('Yes, during the last year');
    fireEvent.click(yesLastYearButtons[0]);
    
    // Question 10: "Yes, during the last year" (4 points)
    fireEvent.click(yesLastYearButtons[1]);
    
    // Submit
    fireEvent.click(screen.getByText('Submit Assessment'));
    
    await waitFor(() => {
      expect(screen.getByText('8/40')).toBeInTheDocument();
      expect(screen.getByText('Increased Risk')).toBeInTheDocument();
    });
  });

  it('converts AUDIT score to craving intensity for check-in', async () => {
    const { apiClient } = require('@/lib/api-client');
    
    render(<AUDITAssessment />);
    
    // Answer to get a score of 20
    // Question 1: "4 or more times a week" (4 points)
    fireEvent.click(screen.getByText('4 or more times a week'));
    
    // Question 2: "10 or more" (4 points)
    fireEvent.click(screen.getByText('10 or more'));
    
    // Questions 3-5: "Daily or almost daily" (4 points each = 12 points)
    for (let i = 0; i < 3; i++) {
      const dailyButtons = screen.getAllByText('Daily or almost daily');
      fireEvent.click(dailyButtons[i]);
    }
    
    // Questions 6-8: "Never" (0 points)
    for (let i = 0; i < 3; i++) {
      const neverButtons = screen.getAllByText('Never');
      fireEvent.click(neverButtons[i]);
    }
    
    // Questions 9-10: "No" (0 points)
    const noButtons = screen.getAllByText('No');
    for (const button of noButtons) {
      fireEvent.click(button);
    }
    
    // Submit
    fireEvent.click(screen.getByText('Submit Assessment'));
    
    await waitFor(() => {
      expect(apiClient.submitCheckIn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AUDIT',
          score: 20,
          riskLevel: 'Possible Dependence',
          substanceUse: true, // score >= 8
          cravingIntensity: 5, // Math.min(10, Math.round(20 / 4))
          assessmentType: 'AUDIT',
          assessmentScore: 20
        })
      );
    });
  });
});