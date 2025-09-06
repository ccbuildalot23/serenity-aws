'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Brain, 
  Wine, 
  Heart, 
  Calendar,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Assessment {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  questionsCount: number;
  estimatedTime: string;
  lastCompleted?: Date;
  lastScore?: number;
  trend?: 'improving' | 'stable' | 'declining';
  path: string;
}

const assessments: Assessment[] = [
  {
    id: 'phq9',
    name: 'PHQ-9',
    description: 'Depression screening assessment',
    icon: <Heart className="w-6 h-6" />,
    color: 'bg-blue-500',
    questionsCount: 9,
    estimatedTime: '3-5 min',
    path: '/patient/assessments/phq9'
  },
  {
    id: 'gad7',
    name: 'GAD-7',
    description: 'Anxiety screening assessment',
    icon: <Brain className="w-6 h-6" />,
    color: 'bg-purple-500',
    questionsCount: 7,
    estimatedTime: '2-3 min',
    path: '/patient/assessments/gad7'
  },
  {
    id: 'audit',
    name: 'AUDIT',
    description: 'Alcohol use screening assessment',
    icon: <Wine className="w-6 h-6" />,
    color: 'bg-amber-500',
    questionsCount: 10,
    estimatedTime: '5-7 min',
    path: '/patient/assessments/audit'
  }
];

export default function AssessmentsPage() {
  const { user } = useStore();
  const [assessmentHistory, setAssessmentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssessmentHistory();
  }, []);

  const fetchAssessmentHistory = async () => {
    try {
      const response = await apiClient.getCheckInHistory(30, 0);
      if (response.data.success) {
        setAssessmentHistory(response.data.checkIns || []);
      }
    } catch (error) {
      console.error('Failed to fetch assessment history:', error);
      // Use mock data for now
      setAssessmentHistory([
        {
          assessmentType: 'PHQ-9',
          assessmentScore: 8,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          assessmentType: 'GAD-7',
          assessmentScore: 12,
          timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getLastAssessment = (type: string) => {
    const assessment = assessmentHistory
      .filter(a => a.assessmentType === type.toUpperCase())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    if (!assessment) return null;
    
    return {
      date: new Date(assessment.timestamp),
      score: assessment.assessmentScore
    };
  };

  const getTrend = (type: string): 'improving' | 'stable' | 'declining' | null => {
    const scores = assessmentHistory
      .filter(a => a.assessmentType === type.toUpperCase())
      .map(a => a.assessmentScore);
    
    if (scores.length < 2) return null;
    
    const recent = scores.slice(0, 3);
    const older = scores.slice(3, 6);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    // For mental health assessments, lower scores are better
    if (recentAvg < olderAvg - 2) return 'improving';
    if (recentAvg > olderAvg + 2) return 'declining';
    return 'stable';
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining' | null) => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingUp className="w-4 h-4 text-red-600" />;
      case 'stable':
        return <Minus className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getSeverityLabel = (type: string, score: number): { label: string; color: string } => {
    switch (type.toLowerCase()) {
      case 'phq9':
        if (score >= 20) return { label: 'Severe', color: 'text-red-600' };
        if (score >= 15) return { label: 'Moderately Severe', color: 'text-orange-600' };
        if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600' };
        if (score >= 5) return { label: 'Mild', color: 'text-blue-600' };
        return { label: 'Minimal', color: 'text-green-600' };
      
      case 'gad7':
        if (score >= 15) return { label: 'Severe', color: 'text-red-600' };
        if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600' };
        if (score >= 5) return { label: 'Mild', color: 'text-blue-600' };
        return { label: 'Minimal', color: 'text-green-600' };
      
      case 'audit':
        if (score >= 20) return { label: 'Possible Dependence', color: 'text-red-600' };
        if (score >= 16) return { label: 'High Risk', color: 'text-orange-600' };
        if (score >= 8) return { label: 'Increased Risk', color: 'text-yellow-600' };
        return { label: 'Low Risk', color: 'text-green-600' };
      
      default:
        return { label: 'Unknown', color: 'text-gray-600' };
    }
  };

  const daysSinceLastAssessment = (date: Date | null): number | null => {
    if (!date) return null;
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const shouldRetake = (days: number | null): boolean => {
    if (days === null) return true;
    return days >= 14; // Recommend retaking after 2 weeks
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Clinical Assessments</h1>
        <p className="text-gray-600">
          Track your mental health progress with evidence-based assessments
        </p>
      </div>

      {/* Alert for overdue assessments */}
      {assessments.some(a => {
        const last = getLastAssessment(a.id);
        const days = daysSinceLastAssessment(last?.date || null);
        return shouldRetake(days);
      }) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-1" size={20} />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Assessment Reminder
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                It's been over 2 weeks since your last assessment. Regular assessments help track your progress.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {assessments.map((assessment) => {
          const lastAssessment = getLastAssessment(assessment.id);
          const trend = getTrend(assessment.id);
          const days = daysSinceLastAssessment(lastAssessment?.date || null);
          const needsRetake = shouldRetake(days);
          const severity = lastAssessment?.score 
            ? getSeverityLabel(assessment.id, lastAssessment.score)
            : null;

          return (
            <div
              key={assessment.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('p-3 rounded-lg text-white', assessment.color)}>
                    {assessment.icon}
                  </div>
                  {trend && (
                    <div className="flex items-center gap-1">
                      {getTrendIcon(trend)}
                      <span className="text-xs text-gray-600 capitalize">{trend}</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold mb-2">{assessment.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{assessment.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={16} />
                    <span>{assessment.estimatedTime}</span>
                    <span className="text-gray-400">•</span>
                    <span>{assessment.questionsCount} questions</span>
                  </div>

                  {lastAssessment && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-gray-600">
                          Last taken: {days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle size={16} className="text-gray-400" />
                        <span className="text-gray-600">
                          Score: {lastAssessment.score}
                        </span>
                        {severity && (
                          <span className={cn('font-medium', severity.color)}>
                            ({severity.label})
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <Link
                  href={assessment.path}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                    needsRetake
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {needsRetake ? 'Take Assessment' : 'Retake Assessment'}
                  <ChevronRight size={20} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Your Progress Summary</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {assessments.map((assessment) => {
            const history = assessmentHistory
              .filter(a => a.assessmentType === assessment.id.toUpperCase())
              .slice(0, 5)
              .reverse();
            
            if (history.length === 0) {
              return (
                <div key={assessment.id} className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    No {assessment.name} history yet
                  </p>
                  <Link
                    href={assessment.path}
                    className="text-purple-600 hover:text-purple-700 text-sm mt-2 inline-block"
                  >
                    Take your first assessment →
                  </Link>
                </div>
              );
            }

            return (
              <div key={assessment.id}>
                <h3 className="font-medium mb-3">{assessment.name} Trend</h3>
                <div className="flex items-end gap-1 h-20">
                  {history.map((item, index) => {
                    const height = (item.assessmentScore / 40) * 100; // Normalize to percentage
                    const severity = getSeverityLabel(assessment.id, item.assessmentScore);
                    
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-gray-200 rounded-t relative group"
                        style={{ height: `${height}%` }}
                      >
                        <div
                          className={cn(
                            'absolute bottom-0 left-0 right-0 rounded-t transition-all',
                            assessment.color.replace('bg-', 'bg-opacity-60 bg-')
                          )}
                          style={{ height: '100%' }}
                        />
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Score: {item.assessmentScore}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">Last 5 assessments</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Educational Content */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-medium mb-2 text-blue-900">Why Regular Assessments Matter</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Track your mental health trends over time</li>
          <li>• Identify patterns and triggers early</li>
          <li>• Provide valuable data to your healthcare provider</li>
          <li>• Celebrate improvements and progress</li>
        </ul>
      </div>
    </div>
  );
}