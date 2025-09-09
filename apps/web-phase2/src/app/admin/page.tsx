'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Users, 
  Activity,
  AlertTriangle,
  Database,
  Settings,
  FileText,
  TrendingUp,
  Server,
  Lock
} from 'lucide-react';
import { withAdminAuth } from '@/hoc/withAuth';
import { useAuth } from '@/providers/AuthProvider';
import SessionTimeout from '@/components/compliance/SessionTimeout';

interface SystemMetrics {
  totalUsers: number;
  activePatients: number;
  activeProviders: number;
  activeSupporters: number;
  totalCheckIns: number;
  totalAlerts: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  auditEvents: number;
}

function AdminDashboard(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activePatients: 0,
    activeProviders: 0,
    activeSupporters: 0,
    totalCheckIns: 0,
    totalAlerts: 0,
    systemHealth: 'healthy',
    auditEvents: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSystemMetrics = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await fetch('/api/admin/metrics');
        // const data = await response.json();
        
        // Mock data for MVP
        const mockMetrics: SystemMetrics = {
          totalUsers: 127,
          activePatients: 89,
          activeProviders: 12,
          activeSupporters: 26,
          totalCheckIns: 2847,
          totalAlerts: 23,
          systemHealth: 'healthy',
          auditEvents: 15203
        };
        
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Failed to load system metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSystemMetrics();
  }, []);

  const adminActions = [
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: Users,
      href: '/admin/users',
      color: 'blue'
    },
    {
      title: 'System Settings',
      description: 'Configure platform settings and features',
      icon: Settings,
      href: '/admin/settings',
      color: 'gray'
    },
    {
      title: 'Audit Logs',
      description: 'Review system activity and compliance logs',
      icon: FileText,
      href: '/admin/audit',
      color: 'purple'
    },
    {
      title: 'Analytics',
      description: 'View platform usage and engagement metrics',
      icon: TrendingUp,
      href: '/admin/analytics',
      color: 'green'
    },
    {
      title: 'System Health',
      description: 'Monitor infrastructure and performance',
      icon: Server,
      href: '/admin/health',
      color: 'orange'
    },
    {
      title: 'Security Center',
      description: 'Manage security policies and incidents',
      icon: Lock,
      href: '/admin/security',
      color: 'red'
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
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-purple-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">
            System administration and platform overview
          </p>
        </div>

        {/* System Health Banner */}
        <div className={`rounded-lg p-4 mb-8 ${
          metrics.systemHealth === 'healthy' ? 'bg-green-50 border border-green-200' :
          metrics.systemHealth === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              metrics.systemHealth === 'healthy' ? 'bg-green-500' :
              metrics.systemHealth === 'warning' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="font-medium">
              System Status: <span className="capitalize">{metrics.systemHealth}</span>
            </span>
            <span className="text-sm text-gray-600 ml-auto">
              Last checked: 2 minutes ago
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.totalUsers}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <div>Patients: {metrics.activePatients}</div>
              <div>Providers: {metrics.activeProviders}</div>
              <div>Supporters: {metrics.activeSupporters}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-ins</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.totalCheckIns.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="text-green-600" size={24} />
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">Total platform check-ins</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Crisis Alerts</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.totalAlerts}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="text-orange-600" size={24} />
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">All-time crisis alerts</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Audit Events</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.auditEvents.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Database className="text-purple-600" size={24} />
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">HIPAA compliance logs</p>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Administration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.href)}
                className="text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div className={`p-3 rounded-lg bg-${action.color}-100 w-fit mb-3`}>
                  <action.icon className={`text-${action.color}-600`} size={24} />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">User Activity</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Active sessions: 47</div>
                <div>Daily check-ins: 156</div>
                <div>Crisis responses: 2</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">System Performance</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Response time: 120ms</div>
                <div>Uptime: 99.9%</div>
                <div>API calls: 12,847</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Compliance</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Audit logs: Current</div>
                <div>Data encryption: Active</div>
                <div>Access controls: Enforced</div>
              </div>
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

export default withAdminAuth(AdminDashboard);