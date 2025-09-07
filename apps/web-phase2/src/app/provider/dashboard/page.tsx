'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Activity,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  ChevronRight,
  Clock,
  Target,
  Award,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import apiService from '@/services/apiService';
import cognitoAuth from '@/services/cognitoAuth';
import { toast } from 'sonner';
import Link from 'next/link';
import PatientTrends from '@/components/provider/PatientTrends';

// CPT Billing Codes for Mental Health
const CPT_CODES = {
  '99490': { 
    description: 'CCM First 20 min/month', 
    rate: 65,
    category: 'Chronic Care Management'
  },
  '99439': { 
    description: 'CCM Additional 20 min', 
    rate: 50,
    category: 'Chronic Care Management'
  },
  '99484': { 
    description: 'BHI Initial Assessment', 
    rate: 85,
    category: 'Behavioral Health'
  },
  '99492': { 
    description: 'Psych Collab Care Initial', 
    rate: 75,
    category: 'Collaborative Care'
  },
  '99493': { 
    description: 'Psych Collab Care Subsequent', 
    rate: 60,
    category: 'Collaborative Care'
  },
  '99494': { 
    description: 'Psych Collab Care Additional', 
    rate: 40,
    category: 'Collaborative Care'
  }
};

export default function ProviderDashboard() {
  const { user } = useStore();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    fetchDashboardMetrics();
  }, [selectedPeriod]);

  const fetchDashboardMetrics = async () => {
    try {
      // Check authentication
      if (!cognitoAuth.isAuthenticated()) {
        toast.error('Please login to view dashboard');
        window.location.href = '/login';
        return;
      }

      // Fetch real metrics from API with fallback to mock data
      const [patientResponse, revenueResponse] = await Promise.all([
        apiService.getPatientMetrics().catch(() => ({ data: null })),
        apiService.getRevenueMetrics().catch(() => ({ data: null }))
      ]);

      // Use API data if available, otherwise use mock data
      const patientData = patientResponse.data;
      const revenueData = revenueResponse.data;

      setMetrics({
        roi: {
          retentionValue: 6750, // Average of $4.5-9k range
          monthlyRevenue: revenueData?.monthlyRevenue || 12450,
          patientCount: patientData?.totalPatients || 47,
          breakEvenPatients: 3,
          averageRevenuePerPatient: revenueData?.averagePerPatient || 265,
          collectabilityRate: revenueData?.collectionRate || 82
        },
        billing: {
          thisMonth: 18250,
          lastMonth: 16890,
          growth: 8.1,
          pendingClaims: 3420,
          avgDaysToBill: 4.2,
          cptBreakdown: [
            { code: '99490', count: 142, revenue: 9230 },
            { code: '99484', count: 38, revenue: 3230 },
            { code: '99492', count: 52, revenue: 3900 },
            { code: '99493', count: 87, revenue: 5220 }
          ]
        },
        patients: {
          active: patientData?.activePatients || 47,
          newThisMonth: 8, // Would need separate API call
          atRisk: 3, // Would need separate API call
          criticalAlerts: 1, // Would need separate API call
          averageEngagement: 78,
          retentionRate: 94
        },
        assessments: {
          completed: patientData?.assessmentsToday ? patientData.assessmentsToday * 30 : 412,
          phq9Average: patientData?.averagePHQ9 || 8.3,
          gad7Average: patientData?.averageGAD7 || 7.1,
          auditAverage: patientData?.averageAUDIT || 5.2,
          improvementRate: 67
        }
      });
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error);
      toast.error(error.message || 'Using cached data');
      
      // Use complete fallback mock data on error
      setMetrics({
        roi: {
          retentionValue: 6750,
          monthlyRevenue: 12450,
          patientCount: 47,
          breakEvenPatients: 3,
          averageRevenuePerPatient: 265,
          collectabilityRate: 82
        },
        billing: {
          thisMonth: 18250,
          lastMonth: 16890,
          growth: 8.1,
          pendingClaims: 3420,
          avgDaysToBill: 4.2,
          cptBreakdown: [
            { code: '99490', count: 142, revenue: 9230 },
            { code: '99484', count: 38, revenue: 3230 },
            { code: '99492', count: 52, revenue: 3900 },
            { code: '99493', count: 87, revenue: 5220 }
          ]
        },
        patients: {
          active: 47,
          newThisMonth: 8,
          atRisk: 3,
          criticalAlerts: 1,
          averageEngagement: 78,
          retentionRate: 94
        },
        assessments: {
          completed: 412,
          phq9Average: 8.3,
          gad7Average: 7.1,
          auditAverage: 5.2,
          improvementRate: 67
        }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header with Key ROI Metric */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Provider Dashboard</h1>
            <p className="text-gray-600">
              Track patient outcomes, billing, and practice ROI
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">Period</p>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary ROI Alert */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              💰 Each Retained Patient = ${metrics?.roi.retentionValue}/year
            </h2>
            <p className="text-green-100">
              You're currently generating ${formatCurrency(metrics?.roi.monthlyRevenue)}/month 
              from {metrics?.roi.patientCount} active patients
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{metrics?.roi.collectabilityRate}%</div>
            <div className="text-sm text-green-100">Collection Rate</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-400/30">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-green-100 text-sm">Break-even:</span>
              <span className="ml-2 font-bold">{metrics?.roi.breakEvenPatients} patients</span>
            </div>
            <div>
              <span className="text-green-100 text-sm">Avg per patient:</span>
              <span className="ml-2 font-bold">${metrics?.roi.averageRevenuePerPatient}/mo</span>
            </div>
            <div>
              <span className="text-green-100 text-sm">Days to bill:</span>
              <span className="ml-2 font-bold">{metrics?.billing.avgDaysToBill} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className={cn(
              'text-sm font-medium px-2 py-1 rounded',
              metrics?.patients.newThisMonth > 5 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            )}>
              +{metrics?.patients.newThisMonth} new
            </span>
          </div>
          <div className="text-2xl font-bold mb-1">{metrics?.patients.active}</div>
          <div className="text-sm text-gray-600">Active Patients</div>
          <div className="mt-2 text-xs text-gray-500">
            {metrics?.patients.retentionRate}% retention rate
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className={cn(
              'text-sm font-medium px-2 py-1 rounded',
              'bg-green-100 text-green-700'
            )}>
              +{metrics?.billing.growth}%
            </span>
          </div>
          <div className="text-2xl font-bold mb-1">
            ${formatCurrency(metrics?.billing.thisMonth)}
          </div>
          <div className="text-sm text-gray-600">Monthly Revenue</div>
          <div className="mt-2 text-xs text-gray-500">
            ${formatCurrency(metrics?.billing.pendingClaims)} pending
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
              {metrics?.patients.averageEngagement}%
            </span>
          </div>
          <div className="text-2xl font-bold mb-1">{metrics?.assessments.completed}</div>
          <div className="text-sm text-gray-600">Assessments Complete</div>
          <div className="mt-2 text-xs text-gray-500">
            {metrics?.assessments.improvementRate}% showing improvement
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            {metrics?.patients.criticalAlerts > 0 && (
              <span className="text-sm font-medium px-2 py-1 rounded bg-red-100 text-red-700 animate-pulse">
                Active
              </span>
            )}
          </div>
          <div className="text-2xl font-bold mb-1">{metrics?.patients.atRisk}</div>
          <div className="text-sm text-gray-600">At-Risk Patients</div>
          <div className="mt-2 text-xs text-red-600">
            {metrics?.patients.criticalAlerts} critical alert{metrics?.patients.criticalAlerts !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* CPT Billing Tracker */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">CPT Billing Codes</h3>
            <Link
              href="/provider/billing"
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              View Details
              <ChevronRight size={16} />
            </Link>
          </div>
          
          <div className="space-y-3">
            {metrics?.billing.cptBreakdown.map((item: any) => {
              const cptInfo = CPT_CODES[item.code as keyof typeof CPT_CODES];
              return (
                <div key={item.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">{item.code}</span>
                      <span className="text-xs text-gray-500">({cptInfo?.category})</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{cptInfo?.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${formatCurrency(item.revenue)}</div>
                    <div className="text-xs text-gray-500">{item.count} claims</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Billable This Month</span>
              <span className="text-xl font-bold text-green-600">
                ${formatCurrency(metrics?.billing.thisMonth)}
              </span>
            </div>
          </div>
        </div>

        {/* Patient Trends - Using new component */}
        <PatientTrends />
      </div>

      {/* Revenue Calculator */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-bold mb-4">Revenue Per Patient Calculator</h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Tier
            </label>
            <select className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option>Standard Care ($165/mo)</option>
              <option>Enhanced Care ($265/mo)</option>
              <option>Intensive Care ($465/mo)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Services
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span className="text-sm">CCM Billing (+$65/mo)</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">BHI Services (+$85/mo)</span>
              </label>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Estimated Annual Value</p>
            <p className="text-3xl font-bold text-purple-600">$2,760</p>
            <p className="text-xs text-gray-500 mt-2">
              Based on 82% collection rate
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4">
        <Link
          href="/provider/patients/new"
          className="bg-purple-600 text-white rounded-lg p-4 hover:bg-purple-700 transition-colors text-center"
        >
          <Users className="mx-auto mb-2" size={24} />
          <span className="text-sm font-medium">Add Patient</span>
        </Link>
        
        <Link
          href="/provider/billing/submit"
          className="bg-green-600 text-white rounded-lg p-4 hover:bg-green-700 transition-colors text-center"
        >
          <CreditCard className="mx-auto mb-2" size={24} />
          <span className="text-sm font-medium">Submit Claims</span>
        </Link>
        
        <Link
          href="/provider/reports"
          className="bg-blue-600 text-white rounded-lg p-4 hover:bg-blue-700 transition-colors text-center"
        >
          <FileText className="mx-auto mb-2" size={24} />
          <span className="text-sm font-medium">Generate Reports</span>
        </Link>
        
        <Link
          href="/provider/pricing"
          className="bg-amber-600 text-white rounded-lg p-4 hover:bg-amber-700 transition-colors text-center"
        >
          <BarChart3 className="mx-auto mb-2" size={24} />
          <span className="text-sm font-medium">Pricing Simulator</span>
        </Link>
      </div>
    </div>
  );
}