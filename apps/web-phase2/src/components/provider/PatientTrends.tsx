'use client';

import React, { useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  Brain,
  Heart,
  Wine
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendData {
  labels: string[];
  phq9: number[];
  gad7: number[];
  audit: number[];
}

interface PatientTrendsProps {
  data?: TrendData;
  patientName?: string;
  period?: 'week' | 'month' | 'quarter';
}

export default function PatientTrends({ 
  data = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    phq9: [15, 14, 12, 11, 9, 8],
    gad7: [12, 11, 10, 9, 8, 7],
    audit: [8, 7, 6, 5, 4, 3]
  },
  patientName = 'All Patients',
  period = 'month'
}: PatientTrendsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simple canvas-based chart (avoiding Chart.js dependency for MVP)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 300;

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height / 5) * i;
      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(30 - i * 6), padding - 10, y + 4);
    }

    // Draw data lines
    const datasets = [
      { data: data.phq9, color: '#3b82f6', label: 'PHQ-9' },
      { data: data.gad7, color: '#8b5cf6', label: 'GAD-7' },
      { data: data.audit, color: '#f59e0b', label: 'AUDIT' }
    ];

    const xStep = width / (data.labels.length - 1);

    datasets.forEach((dataset) => {
      ctx.strokeStyle = dataset.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      dataset.data.forEach((value, index) => {
        const x = padding + xStep * index;
        const y = padding + height - (value / 30) * height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        // Draw point
        ctx.fillStyle = dataset.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.stroke();
    });

    // Draw x-axis labels
    data.labels.forEach((label, index) => {
      const x = padding + xStep * index;
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, canvas.height - padding + 20);
    });

    // Draw legend
    const legendY = 20;
    datasets.forEach((dataset, index) => {
      const legendX = canvas.width - 150 + (index * 50);
      ctx.fillStyle = dataset.color;
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(dataset.label, legendX + 16, legendY + 10);
    });
  }, [data]);

  // Calculate improvements
  const calculateImprovement = (scores: number[]) => {
    if (scores.length < 2) return 0;
    const first = scores[0];
    const last = scores[scores.length - 1];
    return Math.round(((first - last) / first) * 100);
  };

  const phq9Improvement = calculateImprovement(data.phq9);
  const gad7Improvement = calculateImprovement(data.gad7);
  const auditImprovement = calculateImprovement(data.audit);

  const getImprovementColor = (improvement: number) => {
    if (improvement > 20) return 'text-green-600';
    if (improvement > 0) return 'text-blue-600';
    if (improvement === 0) return 'text-gray-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">Assessment Trends</h3>
          <p className="text-sm text-gray-600 mt-1">
            {patientName} - Last {period === 'week' ? '7 days' : period === 'month' ? '30 days' : '90 days'}
          </p>
        </div>
        <Activity className="text-purple-600" size={24} />
      </div>

      {/* Chart */}
      <div className="mb-6">
        <canvas 
          ref={canvasRef}
          className="w-full"
          style={{ maxHeight: '300px' }}
        />
      </div>

      {/* Improvement Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="text-blue-600" size={16} />
              <span className="text-sm font-medium text-blue-900">PHQ-9</span>
            </div>
            {phq9Improvement > 0 ? (
              <TrendingDown className="text-green-600" size={16} />
            ) : (
              <TrendingUp className="text-red-600" size={16} />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-xl font-bold', getImprovementColor(phq9Improvement))}>
              {Math.abs(phq9Improvement)}%
            </span>
            <span className="text-xs text-gray-600">
              {phq9Improvement > 0 ? 'improvement' : phq9Improvement < 0 ? 'increase' : 'no change'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Current: {data.phq9[data.phq9.length - 1]}/27
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="text-purple-600" size={16} />
              <span className="text-sm font-medium text-purple-900">GAD-7</span>
            </div>
            {gad7Improvement > 0 ? (
              <TrendingDown className="text-green-600" size={16} />
            ) : (
              <TrendingUp className="text-red-600" size={16} />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-xl font-bold', getImprovementColor(gad7Improvement))}>
              {Math.abs(gad7Improvement)}%
            </span>
            <span className="text-xs text-gray-600">
              {gad7Improvement > 0 ? 'improvement' : gad7Improvement < 0 ? 'increase' : 'no change'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Current: {data.gad7[data.gad7.length - 1]}/21
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wine className="text-amber-600" size={16} />
              <span className="text-sm font-medium text-amber-900">AUDIT</span>
            </div>
            {auditImprovement > 0 ? (
              <TrendingDown className="text-green-600" size={16} />
            ) : (
              <TrendingUp className="text-red-600" size={16} />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-xl font-bold', getImprovementColor(auditImprovement))}>
              {Math.abs(auditImprovement)}%
            </span>
            <span className="text-xs text-gray-600">
              {auditImprovement > 0 ? 'improvement' : auditImprovement < 0 ? 'increase' : 'no change'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Current: {data.audit[data.audit.length - 1]}/40
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <p className="text-sm text-green-800">
          <strong>Clinical Insight:</strong> Overall improvement of{' '}
          {Math.round((phq9Improvement + gad7Improvement + auditImprovement) / 3)}% 
          {' '}across all assessments. {phq9Improvement > 20 && 'Significant progress in depression symptoms. '}
          {gad7Improvement > 20 && 'Notable reduction in anxiety levels. '}
          {auditImprovement > 20 && 'Positive changes in alcohol use patterns.'}
        </p>
      </div>
    </div>
  );
}