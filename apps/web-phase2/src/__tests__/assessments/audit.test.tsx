/** @jest-environment jsdom */
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

  it('renders first question', () => {
    render(<AUDITAssessment />);
    
    expect(screen.getByText(/How often do you have a drink containing alcohol/i)).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  });

  it('calculates score correctly for low risk', async () => {
    const onComplete = jest.fn();
    render(<AUDITAssessment onComplete={onComplete} />);
    
    // Answer all questions with lowest score
    // Question 1: "Never"
    fireEvent.click(screen.getByText('Never'));
    
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    });
    
    // Question 2: "1 or 2"
    fireEvent.click(screen.getByText('1 or 2'));
    
    // Questions 3-8: "Never"
    for (let i = 2; i < 8; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Never'));
    }
    
    // Questions 9-10: "No"
    for (let i = 8; i < 10; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('No'));
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

  it('triggers crisis alert for possible dependence (score >= 20)', async () => {
    const { apiClient } = require('@/lib/api-client');
    const { toast } = require('sonner');
    const onComplete = jest.fn();
    
    render(<AUDITAssessment onComplete={onComplete} />);
    
    // Answer to get score >= 20
    // Q1: "4 or more times a week" (4 points)
    fireEvent.click(screen.getByText('4 or more times a week'));
    
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    });
    
    // Q2: "10 or more" (4 points)
    fireEvent.click(screen.getByText('10 or more'));
    
    // Q3-6: "Daily or almost daily" (4 points each = 16 points)
    for (let i = 2; i < 6; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Daily or almost daily'));
    }
    
    // Q7-8: "Never" (0 points)
    for (let i = 6; i < 8; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Never'));
    }
    
    // Q9-10: "No" (0 points)
    for (let i = 8; i < 10; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('No'));
    }
    
    // Submit
    const submitButton = screen.getByText('Submit Assessment');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('24/40')).toBeInTheDocument();
      expect(screen.getByText('Possible Dependence')).toBeInTheDocument();
    });
    
    // Verify crisis alert
    expect(apiClient.triggerCrisis).toHaveBeenCalledWith({
      message: 'High AUDIT score detected - possible dependence',
      severity: 'high',
      assessmentScore: 24
    });
    
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Your assessment indicates possible alcohol dependence'),
      expect.objectContaining({ duration: 10000 })
    );
    
    expect(onComplete).toHaveBeenCalledWith(24, 'Possible Dependence');
  });

  it('validates all questions are answered before submission', async () => {
    render(<AUDITAssessment />);
    
    // Check initial state - Next should be disabled
    let nextButton = screen.queryByText('Next');
    if (nextButton) {
      expect(nextButton).toBeDisabled();
    }
    
    // Navigate through first question
    fireEvent.click(screen.getByText('Never'));
    
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    });
    
    // Answer question 2
    fireEvent.click(screen.getByText('1 or 2'));
    
    // Questions 3-8: "Never"
    for (let i = 2; i < 8; i++) {
      await waitFor(() => {
        expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Never'));
    }
    
    // Question 9: "No"
    await waitFor(() => {
      expect(screen.getByText('Question 9 of 10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('No'));
    
    // Last question - submit should be disabled
    await waitFor(() => {
      expect(screen.getByText('Question 10 of 10')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Assessment');
    expect(submitButton).toBeDisabled();
    
    // Answer last question
    fireEvent.click(screen.getByText('No'));
    
    // Now submit should be enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows progress as user answers questions', async () => {
    render(<AUDITAssessment />);
    
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Never'));
    
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  it('allows navigation between questions', async () => {
    render(<AUDITAssessment />);
    
    fireEvent.click(screen.getByText('Never'));
    
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    });
    
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
    
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
  });
});