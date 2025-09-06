'use client';

import React, { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/store/useStore';

const questions = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen'
];

const options = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' }
];

interface Props {
  onComplete?: (score: number, severity: string) => void;
}

export default function GAD7Assessment({ onComplete }: Props) {
  const [responses, setResponses] = useState<number[]>(Array(7).fill(-1));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    let severity = 'Minimal';
    let color = 'text-green-600';
    
    if (score >= 15) {
      severity = 'Severe';
      color = 'text-red-600';
    } else if (score >= 10) {
      severity = 'Moderate';
      color = 'text-yellow-600';
    } else if (score >= 5) {
      severity = 'Mild';
      color = 'text-blue-600';
    }

    return { score, severity, color };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const { score, severity } = calculateResults();
    
    try {
      // Client-side processing for privacy - only send final score
      const assessmentData = {
        type: 'GAD-7',
        score,
        severity,
        completedAt: new Date().toISOString(),
        // Don't send individual responses for privacy
      };

      // Submit to API
      await apiClient.submitCheckIn({
        ...assessmentData,
        mood: 5, // Default values for check-in
        anxiety: Math.min(10, Math.round(score / 2.1)), // Convert GAD-7 to 1-10 scale
        sleepHours: 7,
        sleepQuality: 5,
        assessmentType: 'GAD-7',
        assessmentScore: score
      });

      // Crisis escalation for high scores (research-validated threshold)
      if (score >= 15) {
        toast.error('Your anxiety level indicates you may need immediate support. Alerting your care team.', {
          duration: 10000,
        });
        
        // Trigger crisis protocol
        await apiClient.triggerCrisis({
          message: 'High GAD-7 score detected',
          severity: 'high',
          assessmentScore: score
        }).catch(err => console.error('Crisis alert failed:', err));
      }
      
      setShowResults(true);
      
      if (onComplete) {
        onComplete(score, severity);
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
    const { score, severity, color } = calculateResults();
    
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">GAD-7 Anxiety Assessment Results</h2>
        
        <div className="text-center py-8">
          <div className="text-5xl font-bold mb-2">{score}/21</div>
          <div className={cn('text-2xl font-medium', color)}>{severity} Anxiety</div>
        </div>

        <div className="space-y-4 mt-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">What this means:</h3>
            {severity === 'Minimal' && (
              <p className="text-sm text-gray-600">
                Your anxiety levels are within normal range. Continue your current self-care practices.
              </p>
            )}
            {severity === 'Mild' && (
              <p className="text-sm text-gray-600">
                You're experiencing mild anxiety. Consider stress-reduction techniques and monitor your symptoms.
              </p>
            )}
            {severity === 'Moderate' && (
              <p className="text-sm text-gray-600">
                Moderate anxiety can impact daily life. Consider speaking with your healthcare provider about treatment options.
              </p>
            )}
            {severity === 'Severe' && (
              <p className="text-sm text-gray-600">
                Severe anxiety requires professional attention. Please contact your healthcare provider soon.
              </p>
            )}
          </div>

          {score >= 15 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 mt-1" size={20} />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Immediate Support Available
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Crisis Hotline: 988 (24/7)<br />
                    Text "HELLO" to 741741
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Longitudinal tracking preview */}
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Your assessment has been saved. Track your progress over time in your dashboard.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowResults(false);
            setCurrentQuestion(0);
            setResponses(Array(7).fill(-1));
          }}
          className="w-full mt-6 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Take Assessment Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">GAD-7 Anxiety Assessment</h2>
        <p className="text-sm text-gray-600">
          Over the last 2 weeks, how often have you been bothered by the following problems?
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
          {currentQuestion + 1}. {questions[currentQuestion]}
        </h3>
        
        <div className="space-y-2">
          {options.map((option) => (
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
              'px-6 py-2 rounded-lg transition-colors',
              !isComplete || isSubmitting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
            )}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        )}
      </div>
    </div>
  );
}