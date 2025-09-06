'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Smile, 
  Frown, 
  Meh, 
  AlertCircle, 
  Moon, 
  Activity,
  Heart,
  Brain,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

const moodEmojis = [
  { value: 1, emoji: '😢', label: 'Very Low' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Slightly Low' },
  { value: 4, emoji: '😊', label: 'Okay' },
  { value: 5, emoji: '😌', label: 'Good' },
  { value: 6, emoji: '😃', label: 'Very Good' },
  { value: 7, emoji: '😄', label: 'Great' },
  { value: 8, emoji: '🥰', label: 'Excellent' },
  { value: 9, emoji: '🤗', label: 'Amazing' },
  { value: 10, emoji: '🎉', label: 'Perfect' },
];

const triggers = [
  'Work stress',
  'Family issues',
  'Financial concerns',
  'Health problems',
  'Relationship issues',
  'Isolation',
  'Boredom',
  'Cravings',
  'Social situations',
  'Negative thoughts',
];

const copingStrategies = [
  'Deep breathing',
  'Meditation',
  'Exercise',
  'Called a friend',
  'Journaling',
  'Music',
  'Nature walk',
  'Reading',
  'Therapy techniques',
  'Support group',
];

export default function DailyCheckInPage() {
  const router = useRouter();
  const { setLastCheckIn, setCheckInStreak } = useStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [checkInData, setCheckInData] = useState({
    mood: 5,
    anxiety: 5,
    sleepHours: 7,
    sleepQuality: 5,
    medication: false,
    exercise: false,
    socialInteraction: false,
    substanceUse: false,
    cravingIntensity: 0,
    triggers: [] as string[],
    copingStrategiesUsed: [] as string[],
    gratitude: '',
    notes: '',
    supportNeeded: false,
    crisisFlag: false,
  });

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleToggleTrigger = (trigger: string) => {
    setCheckInData(prev => ({
      ...prev,
      triggers: prev.triggers.includes(trigger)
        ? prev.triggers.filter(t => t !== trigger)
        : [...prev.triggers, trigger],
    }));
  };

  const handleToggleCoping = (strategy: string) => {
    setCheckInData(prev => ({
      ...prev,
      copingStrategiesUsed: prev.copingStrategiesUsed.includes(strategy)
        ? prev.copingStrategiesUsed.filter(s => s !== strategy)
        : [...prev.copingStrategiesUsed, strategy],
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.submitCheckIn(checkInData);
      
      if (response.data.success) {
        setLastCheckIn(new Date());
        setCheckInStreak(response.data.insights?.streakDays || 1);
        
        toast.success(response.data.message || 'Check-in completed successfully!');
        
        // Check for crisis flags
        if (response.data.insights?.riskLevel === 'high' || response.data.insights?.riskLevel === 'critical') {
          toast.error('We noticed you might need extra support. Help is available.', {
            duration: 10000,
          });
        }
        
        router.push('/patient/dashboard');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to submit check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">How are you feeling today?</h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">Overall Mood</label>
              <div className="grid grid-cols-5 gap-2">
                {moodEmojis.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => setCheckInData(prev => ({ ...prev, mood: mood.value }))}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all',
                      checkInData.mood === mood.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="text-2xl">{mood.emoji}</div>
                    <div className="text-xs mt-1">{mood.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Anxiety Level (1-10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={checkInData.anxiety}
                onChange={(e) => setCheckInData(prev => ({ ...prev, anxiety: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Low</span>
                <span className="font-bold text-lg">{checkInData.anxiety}</span>
                <span>High</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Craving Intensity (0-10)
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={checkInData.cravingIntensity}
                onChange={(e) => setCheckInData(prev => ({ ...prev, cravingIntensity: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>None</span>
                <span className="font-bold text-lg">{checkInData.cravingIntensity}</span>
                <span>Intense</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Sleep & Self-Care</h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">
                Hours of Sleep
              </label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={checkInData.sleepHours}
                onChange={(e) => setCheckInData(prev => ({ ...prev, sleepHours: parseFloat(e.target.value) }))}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Sleep Quality (1-10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={checkInData.sleepQuality}
                onChange={(e) => setCheckInData(prev => ({ ...prev, sleepQuality: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Poor</span>
                <span className="font-bold text-lg">{checkInData.sleepQuality}</span>
                <span>Excellent</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">Today I...</label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkInData.medication}
                  onChange={(e) => setCheckInData(prev => ({ ...prev, medication: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>Took my medication as prescribed</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkInData.exercise}
                  onChange={(e) => setCheckInData(prev => ({ ...prev, exercise: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>Exercised or moved my body</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkInData.socialInteraction}
                  onChange={(e) => setCheckInData(prev => ({ ...prev, socialInteraction: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>Had positive social interaction</span>
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Triggers & Challenges</h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">
                What triggered difficult feelings today?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {triggers.map((trigger) => (
                  <button
                    key={trigger}
                    onClick={() => handleToggleTrigger(trigger)}
                    className={cn(
                      'p-2 text-sm rounded-lg border transition-all',
                      checkInData.triggers.includes(trigger)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {trigger}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkInData.substanceUse}
                  onChange={(e) => setCheckInData(prev => ({ ...prev, substanceUse: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>I used substances today</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkInData.supportNeeded}
                  onChange={(e) => setCheckInData(prev => ({ ...prev, supportNeeded: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>I could use some extra support today</span>
              </label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Coping & Growth</h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">
                Coping strategies I used today
              </label>
              <div className="grid grid-cols-2 gap-2">
                {copingStrategies.map((strategy) => (
                  <button
                    key={strategy}
                    onClick={() => handleToggleCoping(strategy)}
                    className={cn(
                      'p-2 text-sm rounded-lg border transition-all',
                      checkInData.copingStrategiesUsed.includes(strategy)
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {strategy}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Something I'm grateful for today
              </label>
              <textarea
                value={checkInData.gratitude}
                onChange={(e) => setCheckInData(prev => ({ ...prev, gratitude: e.target.value }))}
                placeholder="What brought you joy or peace today?"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Additional Notes</h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">
                Anything else you'd like to share?
              </label>
              <textarea
                value={checkInData.notes}
                onChange={(e) => setCheckInData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any thoughts, feelings, or experiences you want to record..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={6}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 mt-1" size={20} />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Need immediate support?
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    If you're experiencing a crisis or having thoughts of self-harm, 
                    please reach out for help immediately.
                  </p>
                  <button
                    onClick={() => setCheckInData(prev => ({ ...prev, crisisFlag: true }))}
                    className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Request Crisis Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">Step {step} of 5</span>
            <span className="text-sm text-gray-500">{Math.round((step / 5) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className={cn(
              'px-6 py-2 rounded-lg transition-colors',
              step === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            )}
          >
            Previous
          </button>

          {step < 5 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                'px-6 py-2 rounded-lg transition-colors flex items-center gap-2',
                isSubmitting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Complete Check-in
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}