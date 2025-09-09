'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  Activity
} from 'lucide-react';
import { withProviderAuth } from '@/hoc/withAuth';
import { useAuth } from '@/providers/AuthProvider';
import SessionTimeout from '@/components/compliance/SessionTimeout';

interface ProviderMetrics {
  totalPatients: number;
  activePatients: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  pendingAlerts: number;
  averageEngagement: number;
  billingOpportunities: number;
  lastWeekCheckIns: number;
}

function ProviderDashboard(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<ProviderMetrics>({
    totalPatients: 0,
    activePatients: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    pendingAlerts: 0,
    averageEngagement: 0,
    billingOpportunities: 0,
    lastWeekCheckIns: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadProviderMetrics = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await fetch('/api/provider/dashboard');
        // const data = await response.json();
        
        // Mock data for MVP
        const mockMetrics: ProviderMetrics = {
          totalPatients: 42,
          activePatients: 38,
          monthlyRevenue: 12500,
          revenueGrowth: 8.5,
          pendingAlerts: 3,
          averageEngagement: 85,
          billingOpportunities: 28,
          lastWeekCheckIns: 156
        };
        
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Failed to load provider metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProviderMetrics();
  }, []);

  const metricCards = [
    {
      title: 'Total Patients',
      value: metrics.totalPatients.toString(),
      subtitle: `${metrics.activePatients} active`,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Monthly Revenue',
      value: `$${metrics.monthlyRevenue.toLocaleString()}`,
      subtitle: `+${metrics.revenueGrowth}% from last month`,
      icon: DollarSign,
      color: 'green'
    },
    {
      title: 'Engagement Rate',
      value: `${metrics.averageEngagement}%`,
      subtitle: `${metrics.lastWeekCheckIns} check-ins this week`,
      icon: TrendingUp,
      color: 'purple'
    },
    {
      title: 'Pending Alerts',
      value: metrics.pendingAlerts.toString(),
      subtitle: 'Require attention',
      icon: AlertTriangle,
      color: metrics.pendingAlerts > 0 ? 'red' : 'gray'
    }
  ];

  const quickActions = [
    {
      title: 'Patient Management',
      description: 'View and manage your patient roster',
      icon: Users,
      href: '/provider/patients',
      color: 'blue'
    },
    {
      title: 'Billing Dashboard',
      description: 'Manage charges and generate superbills',
      icon: FileText,
      href: '/provider/billing',
      color: 'green'
    },
    {
      title: 'Analytics',
      description: 'View engagement and outcome metrics',
      icon: Activity,
      href: '/provider/analytics',
      color: 'purple'
    },
    {
      title: 'Schedule',
      description: 'View appointments and availability',
      icon: Calendar,
      href: '/provider/schedule',
      color: 'orange'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || 'Provider'}
          </h1>
          <p className="text-gray-600">
            Here's your patient engagement and revenue overview
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricCards.map((card, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg bg-${card.color}-100`}>
                  <card.icon className={`text-${card.color}-600`} size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500">{card.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.href)}
                className="text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div className={`p-2 rounded-lg bg-${action.color}-100 w-fit mb-3`}>
                  <action.icon className={`text-${action.color}-600`} size={20} />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="text-gray-400" size={16} />
              <span className="text-sm text-gray-600">
                3 new check-ins from patients in the last hour
              </span>
            </div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-yellow-500" size={16} />
              <span className="text-sm text-gray-600">
                1 patient flagged for follow-up (moderate anxiety increase)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="text-green-500" size={16} />
              <span className="text-sm text-gray-600">
                5 billing opportunities identified for this week
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Timeout Component */}
      <SessionTimeout
        timeoutMinutes={15}
        warningMinutes={2}
        onTimeout={() => router.push('/login?reason=timeout')}
      />
    </div>
  );
}

export default withProviderAuth(ProviderDashboard);