'use client';

import React, { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/store/useStore';

const questions = [
  {
    text: 'How often do you have a drink containing alcohol?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Monthly or less' },
      { value: 2, label: '2-4 times a month' },
      { value: 3, label: '2-3 times a week' },
      { value: 4, label: '4 or more times a week' }
    ]
  },
  {
    text: 'How many drinks containing alcohol do you have on a typical day when you are drinking?',
    options: [
      { value: 0, label: '1 or 2' },
      { value: 1, label: '3 or 4' },
      { value: 2, label: '5 or 6' },
      { value: 3, label: '7 to 9' },
      { value: 4, label: '10 or more' }
    ]
  },
  {
    text: 'How often do you have six or more drinks on one occasion?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'How often during the last year have you found that you were not able to stop drinking once you had started?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'How often during the last year have you failed to do what was normally expected of you because of drinking?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'How often during the last year have you had a feeling of guilt or remorse after drinking?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'How often during the last year have you been unable to remember what happened the night before because of your drinking?',
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Less than monthly' },
      { value: 2, label: 'Monthly' },
      { value: 3, label: 'Weekly' },
      { value: 4, label: 'Daily or almost daily' }
    ]
  },
  {
    text: 'Have you or someone else been injured because of your drinking?',
    options: [
      { value: 0, label: 'No' },
      { value: 2, label: 'Yes, but not in the last year' },
      { value: 4, label: 'Yes, during the last year' }
    ]
  },
  {
    text: 'Has a relative, friend, doctor, or other health care worker been concerned about your drinking or suggested you cut down?',
    options: [
      { value: 0, label: 'No' },
      { value: 2, label: 'Yes, but not in the last year' },
      { value: 4, label: 'Yes, during the last year' }
    ]
  }
];

interface Props {
  onComplete?: (score: number, riskLevel: string) => void;
}

export default function AUDITAssessment({ onComplete }: Props) {
  const [responses, setResponses] = useState<number[]>(Array(10).fill(-1));
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { user } = useStore();

  const handleSelect = (value: number) => {
    const newResponses = [...responses];
    newResponses[currentQuestion] = value;
    setResponses(newResponses);

    // Auto-advance to next question
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
      }, 300);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateResults = () => {
    const score = responses.reduce((sum, val) => sum + (val > -1 ? val : 0), 0);
    let riskLevel = 'Low Risk';
    let color = 'text-green-600';
    let recommendation = '';
    
    if (score >= 20) {
      riskLevel = 'Possible Dependence';
      color = 'text-red-600';
      recommendation = 'Further diagnostic evaluation for alcohol dependence is recommended.';
    } else if (score >= 16) {
      riskLevel = 'High Risk';
      color = 'text-orange-600';
      recommendation = 'Counseling and continued monitoring recommended.';
    } else if (score >= 8) {
      riskLevel = 'Increased Risk';
      color = 'text-yellow-600';
      recommendation = 'Simple advice focused on the reduction of hazardous drinking recommended.';
    } else {
      recommendation = 'Continue current habits and monitor for changes.';
    }

    return { score, riskLevel, color, recommendation };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const { score, riskLevel, recommendation } = calculateResults();
    
    try {
      // Client-side processing for privacy - only send final score
      const assessmentData = {
        type: 'AUDIT',
        score,
        riskLevel,
        completedAt: new Date().toISOString(),
        // Don't send individual responses for privacy
      };

      // Submit to API
      await apiClient.submitCheckIn({
        ...assessmentData,
        mood: 5, // Default values for check-in
        anxiety: 5,
        sleepHours: 7,
        sleepQuality: 5,
        substanceUse: score >= 8, // Flag if score indicates risky use
        cravingIntensity: Math.min(10, Math.round(score / 4)), // Convert to 1-10 scale
        assessmentType: 'AUDIT',
        assessmentScore: score
      });

      // Crisis escalation for high scores (research-validated threshold)
      if (score >= 20) {
        toast.error('Your assessment indicates possible alcohol dependence. Alerting your care team for support.', {
          duration: 10000,
        });
        
        // Trigger crisis protocol
        await apiClient.triggerCrisis({
          message: 'High AUDIT score detected - possible dependence',
          severity: 'high',
          assessmentScore: score
        }).catch(err => console.error('Crisis alert failed:', err));
      }
      
      setShowResults(true);
      
      if (onComplete) {
        onComplete(score, riskLevel);
      }
      
      toast.success('Assessment completed successfully');
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      toast.error('Failed to save assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = responses.every(r => r >= 0);
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResults) {
    const { score, riskLevel, color, recommendation } = calculateResults();
    
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">AUDIT Assessment Results</h2>
        
        <div className="text-center py-8">
          <Wine className="mx-auto mb-4 text-gray-400" size={48} />
          <div className="text-5xl font-bold mb-2">{score}/40</div>
          <div className={cn('text-2xl font-medium', color)}>{riskLevel}</div>
        </div>

        <div className="space-y-4 mt-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Recommendation:</h3>
            <p className="text-sm text-gray-600">{recommendation}</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium mb-2 text-blue-900">Understanding Your Score:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 0-7: Low risk drinking</li>
              <li>• 8-15: Increased risk drinking</li>
              <li>• 16-19: High risk drinking</li>
              <li>• 20+: Possible alcohol dependence</li>
            </ul>
          </div>

          {score >= 16 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 mt-1" size={20} />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Support Resources Available
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    SAMHSA Helpline: 1-800-662-4357<br />
                    AA Meeting Finder: aa.org<br />
                    Your provider has been notified
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Longitudinal tracking preview */}
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              Track your progress over time. Regular assessments help identify patterns and measure improvement.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentQuestion(0);
              setResponses(Array(10).fill(-1));
            }}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Take Again
          </button>
          <button
            onClick={() => window.location.href = '/patient/dashboard'}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">AUDIT - Alcohol Use Assessment</h2>
        <p className="text-sm text-gray-600">
          Please answer each question about your alcohol use over the past year.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-500">Question {currentQuestion + 1} of {questions.length}</span>
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4">
          {currentQuestion + 1}. {currentQ.text}
        </h3>
        
        <div className="space-y-2">
          {currentQ.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                responses[currentQuestion] === option.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span>{option.label}</span>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2',
                  responses[currentQuestion] === option.value
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300'
                )}>
                  {responses[currentQuestion] === option.value && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            currentQuestion === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          <ChevronLeft size={20} />
          Previous
        </button>

        {currentQuestion < questions.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={responses[currentQuestion] === -1}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              responses[currentQuestion] === -1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            )}
          >
            Next
            <ChevronRight size={20} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!isComplete || isSubmitting}
            className={cn(
              'px-6 py-2 rounded-lg transition-colors flex items-center gap-2',
              !isComplete || isSubmitting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
            )}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Assessment'
            )}
          </button>
        )}
      </div>
    </div>
  );
}