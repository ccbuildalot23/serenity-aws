'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  Calendar, 
  TrendingUp, 
  Heart, 
  Activity, 
  Moon,
  Zap,
  ArrowRight,
  AlertTriangle,
  Clock,
  X
} from 'lucide-react';
import SessionTimeout from '@/components/compliance/SessionTimeout';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';

interface InsightCard {
  id: string;
  type: 'mood_pattern' | 'anxiety_trend' | 'sleep_correlation' | 'streak_milestone';
  title: string;
  description: string;
  value: string;
  trend?: 'up' | 'down' | 'stable';
  dismissed?: boolean;
}

// PRD: Home page with daily check-in card, streak stats, insight cards
export default function PatientHomePage(): JSX.Element {
  const router = useRouter();
  const { lastCheckIn, checkInStreak } = useStore();
  const { user, isAuthenticated } = useAuth();
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());

  // Check if user has checked in today
  const hasCheckedInToday = lastCheckIn && 
    new Date(lastCheckIn).toDateString() === new Date().toDateString();

  // Load dismissed cards from secure store (non-PHI data only)
  useEffect(() => {
    try {
      // Note: This is non-PHI data (UI preferences only)
      // Behavioral insights may contain PHI - removed for HIPAA compliance
      if (dismissed) {
        setDismissedCards(new Set(JSON.parse(dismissed)));
      }
    } catch (error) {
      console.error('Failed to load dismissed insights:', error);
    }
  }, []);

  // Generate insight cards (PRD: after ≥5 check-ins, 80% see first card by day 7)
  useEffect(() => {
    const generateInsights = () => {
      // Mock insights based on check-in history
      // In production, these would come from /api/checkins/stats
      const mockInsights: InsightCard[] = [
        {
          id: 'mood_morning',
          type: 'mood_pattern',
          title: 'Morning Mood Boost',
          description: 'Your mood tends to be highest around 9 AM',
          value: '7.2 avg',
          trend: 'up'
        },
        {
          id: 'anxiety_thursday',
          type: 'anxiety_trend', 
          title: 'Thursday Pattern',
          description: 'Anxiety tends to spike on Thursdays',
          value: '6.8 avg',
          trend: 'up'
        },
        {
          id: 'sleep_correlation',
          type: 'sleep_correlation',
          title: 'Sleep & Mood Link',
          description: 'Better sleep correlates with improved mood',
          value: '85% match',
          trend: 'stable'
        }
      ];

      // Only show insights if user has sufficient check-ins
      if (checkInStreak >= 5) {
        setInsights(mockInsights.filter(card => !dismissedCards.has(card.id)));
      }
    };

    generateInsights();
  }, [checkInStreak, dismissedCards]);

  const dismissInsight = (cardId: string): void => {
    const newDismissed = new Set(dismissedCards);
    newDismissed.add(cardId);
    setDismissedCards(newDismissed);
    
    try {
      // Behavioral insights removed from localStorage - HIPAA compliance
    } catch (error) {
      console.error('Failed to save dismissed insights:', error);
    }
    
    setInsights(prev => prev.filter(card => card.id !== cardId));
  };

  const getTrendIcon = (trend?: string): JSX.Element => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={16} className="text-green-500" />;
      case 'down':
        return <TrendingUp size={16} className="text-red-500 rotate-180" />;
      default:
        return <Activity size={16} className="text-blue-500" />;
    }
  };

  const getInsightIcon = (type: string): JSX.Element => {
    switch (type) {
      case 'mood_pattern':
        return <Heart className="text-purple-500" size={20} />;
      case 'anxiety_trend':
        return <Activity className="text-orange-500" size={20} />;
      case 'sleep_correlation':
        return <Moon className="text-blue-500" size={20} />;
      default:
        return <Zap className="text-yellow-500" size={20} />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-gray-600">How are you feeling today?</p>
        {user?.sessionExpiresAt && (
          <p className="text-xs text-gray-500">
            Session expires in {Math.floor((new Date(user.sessionExpiresAt).getTime() - Date.now()) / 60000)} minutes
          </p>
        )}
      </div>

      {/* Daily Check-in Card - PRD: Primary CTA */}
      <div className={cn(
        'bg-white rounded-xl shadow-lg p-6 border-2 transition-all',
        hasCheckedInToday 
          ? 'border-green-200 bg-green-50' 
          : 'border-purple-200 hover:border-purple-300'
      )}>
        {hasCheckedInToday ? (
          <div className="text-center space-y-3">
            <CheckCircle className="mx-auto text-green-500" size={48} />
            <h2 className="text-xl font-semibold text-green-800">Check-in Complete!</h2>
            <p className="text-green-600">Thanks for sharing how you're feeling today.</p>
            <div className="flex items-center justify-center gap-2 text-sm text-green-700">
              <Calendar size={16} />
              <span>Checked in at {new Date(lastCheckIn!).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="p-3 bg-purple-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <Heart className="text-purple-600" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Daily Check-in</h2>
              <p className="text-gray-600 text-sm">Quick mood, anxiety, and sleep check</p>
            </div>
            <button
              onClick={() => router.push('/patient/check-in')}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Clock size={20} />
              Start Check-in
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Streak Stats - PRD: Display streak and summary stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Check-in Streak</h3>
            <p className="text-sm text-gray-600">Keep up the great work!</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-600">{checkInStreak}</div>
            <div className="text-sm text-gray-500">days</div>
          </div>
        </div>
        
        {checkInStreak > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Zap className="text-yellow-500" size={16} />
            <span className="text-sm text-gray-700">
              {checkInStreak === 1 && "Great start! Keep it going."}
              {checkInStreak >= 2 && checkInStreak < 7 && "Building momentum!"}
              {checkInStreak >= 7 && checkInStreak < 30 && "You're on a roll!"}
              {checkInStreak >= 30 && "Incredible dedication!"}
            </span>
          </div>
        )}
      </div>

      {/* Insight Cards - PRD: Pattern summaries with small charts */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Insights</h3>
          {insights.map((insight) => (
            <div key={insight.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      {getTrendIcon(insight.trend)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <div className="text-lg font-bold text-purple-600">{insight.value}</div>
                  </div>
                </div>
                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dismiss insight"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crisis Support - Always accessible */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-500 mt-0.5" size={20} />
          <div>
            <h4 className="font-semibold text-red-800 mb-1">Need Support?</h4>
            <p className="text-sm text-red-700 mb-3">
              If you're having a difficult time, help is available 24/7.
            </p>
            <button
              onClick={() => router.push('/patient/support')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Get Help Now
            </button>
          </div>
        </div>
      </div>

      {/* Navigation hint for first-time users */}
      {checkInStreak === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-blue-700">
            <h4 className="font-semibold mb-1">Getting Started</h4>
            <p className="text-sm">
              Complete your first check-in to start building insights and tracking your progress.
            </p>
          </div>
        </div>
      )}
      {/* Session Timeout Component */}      <SessionTimeout        timeoutMinutes={15}        warningMinutes={2}        onTimeout={() => router.push('/login?reason=timeout')}      />
    </div>
  );
}