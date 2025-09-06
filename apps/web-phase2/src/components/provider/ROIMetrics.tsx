'use client';

import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target,
  Award,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ROIMetricsProps {
  metrics?: {
    retentionValue: number;
    monthlyRevenue: number;
    patientCount: number;
    breakEvenPatients: number;
    averageRevenuePerPatient: number;
    collectabilityRate: number;
    projectedAnnualRevenue?: number;
    costSavingsPerPatient?: number;
  };
  variant?: 'default' | 'compact' | 'detailed';
  showProjections?: boolean;
}

export default function ROIMetrics({ 
  metrics = {
    retentionValue: 6750,
    monthlyRevenue: 12450,
    patientCount: 47,
    breakEvenPatients: 3,
    averageRevenuePerPatient: 265,
    collectabilityRate: 82,
    projectedAnnualRevenue: 149400,
    costSavingsPerPatient: 4500
  },
  variant = 'default',
  showProjections = true 
}: ROIMetricsProps) {
  
  const annualRetentionValue = metrics.retentionValue * metrics.patientCount;
  const monthlyBreakEvenRevenue = metrics.averageRevenuePerPatient * metrics.breakEvenPatients;
  const profitMargin = ((metrics.monthlyRevenue - monthlyBreakEvenRevenue) / metrics.monthlyRevenue * 100).toFixed(1);
  
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-100">Patient Retention Value</p>
            <p className="text-2xl font-bold">${metrics.retentionValue}/year</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-100">Monthly Revenue</p>
            <p className="text-2xl font-bold">${metrics.monthlyRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" size={24} />
            ROI Analysis
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Info size={16} />
            <span>Based on {metrics.patientCount} active patients</span>
          </div>
        </div>

        {/* Key Value Proposition */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Award className="text-green-600 mt-1" size={20} />
            <div>
              <p className="font-bold text-green-900 text-lg">
                Each retained patient = ${metrics.retentionValue}/year
              </p>
              <p className="text-sm text-green-700 mt-1">
                Industry standard: Losing a patient costs $4,500-$9,000 in lifetime value
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Monthly Revenue</span>
              <TrendingUp className="text-green-500" size={16} />
            </div>
            <p className="text-2xl font-bold">${metrics.monthlyRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              ${metrics.averageRevenuePerPatient} per patient
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Break-even Point</span>
              <Target className="text-purple-500" size={16} />
            </div>
            <p className="text-2xl font-bold">{metrics.breakEvenPatients} patients</p>
            <p className="text-xs text-gray-500 mt-1">
              Covers Professional tier ($299/mo)
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Collection Rate</span>
              <DollarSign className="text-blue-500" size={16} />
            </div>
            <p className="text-2xl font-bold">{metrics.collectabilityRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              Industry avg: 75-80%
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Profit Margin</span>
              <Award className="text-amber-500" size={16} />
            </div>
            <p className="text-2xl font-bold">{profitMargin}%</p>
            <p className="text-xs text-gray-500 mt-1">
              After platform costs
            </p>
          </div>
        </div>

        {/* Projections */}
        {showProjections && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-gray-700">Annual Projections</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Projected Annual Revenue</span>
                <span className="font-bold text-green-600">
                  ${(metrics.monthlyRevenue * 12).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Retention Value</span>
                <span className="font-bold text-purple-600">
                  ${annualRetentionValue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cost Savings (vs. turnover)</span>
                <span className="font-bold text-blue-600">
                  ${(metrics.costSavingsPerPatient! * metrics.patientCount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-6 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>💡 Insight:</strong> With {metrics.patientCount} patients, you're preventing 
            ${annualRetentionValue.toLocaleString()} in annual turnover costs while generating 
            ${(metrics.monthlyRevenue * 12).toLocaleString()} in revenue.
          </p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            💰 Each Retained Patient = ${metrics.retentionValue}/year
          </h2>
          <p className="text-green-100">
            You're currently generating ${metrics.monthlyRevenue.toLocaleString()}/month 
            from {metrics.patientCount} active patients
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{metrics.collectabilityRate}%</div>
          <div className="text-sm text-green-100">Collection Rate</div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-green-400/30">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-green-100 text-sm">Break-even:</span>
            <span className="ml-2 font-bold">{metrics.breakEvenPatients} patients</span>
          </div>
          <div>
            <span className="text-green-100 text-sm">Avg per patient:</span>
            <span className="ml-2 font-bold">${metrics.averageRevenuePerPatient}/mo</span>
          </div>
          <div>
            <span className="text-green-100 text-sm">Annual projection:</span>
            <span className="ml-2 font-bold">${(metrics.monthlyRevenue * 12).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}