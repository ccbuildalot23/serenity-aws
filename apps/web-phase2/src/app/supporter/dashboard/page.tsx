'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Shield,
  Activity,
  MessageCircle,
  Phone,
  TrendingUp,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { apiClient } from '@/lib/api-client';
import { auditLogger, AuditEventType } from '@/utils/auditLog';
import Link from 'next/link';

interface SupportAlert {
  id: string;
  patientInitials: string; // Privacy-preserving
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'check_in_needed' | 'assessment_due' | 'crisis' | 'milestone' | 'general';
  message: string; // Non-PHI message
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  requiresAction: boolean;
  actionUrl?: string;
}

// Mock alerts for demonstration
const mockAlerts: SupportAlert[] = [
  {
    id: '1',
    patientInitials: 'SJ',
    severity: 'critical',
    type: 'crisis',
    message: 'Patient needs immediate support',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    acknowledged: false,
    requiresAction: true,
    actionUrl: '/supporter/crisis-response'
  },
  {
    id: '2',
    patientInitials: 'MC',
    severity: 'high',
    type: 'check_in_needed',
    message: 'Daily check-in overdue by 3 days',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    acknowledged: false,
    requiresAction: true
  },
  {
    id: '3',
    patientInitials: 'ER',
    severity: 'medium',
    type: 'assessment_due',
    message: 'Weekly assessment reminder',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    acknowledgedBy: 'supporter@example.com',
    requiresAction: false
  },
  {
    id: '4',
    patientInitials: 'JW',
    severity: 'low',
    type: 'milestone',
    message: '30 days of sobriety achieved! 🎉',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    requiresAction: false
  }
];

export default function SupporterDashboard() {
  const { user } = useStore();
  const [alerts, setAlerts] = useState<SupportAlert[]>(mockAlerts);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    unacknowledged: 0,
    criticalAlerts: 0,
    avgResponseTime: 0
  });

  useEffect(() => {
    fetchAlerts();
    calculateStats();
    
    // Log access
    auditLogger.log({
      event: AuditEventType.PHI_VIEW,
      action: 'Supporter dashboard accessed',
      resource: 'supporter_alerts',
      userId: user?.id,
      phiAccessed: false // No PHI shown
    });
  }, [user]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      // In production, fetch from API
      // const response = await apiClient.getSupporterAlerts();
      // setAlerts(response.data.alerts);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = alerts.length;
    const unack = alerts.filter(a => !a.acknowledged).length;
    const critical = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
    
    // Calculate average response time for acknowledged alerts
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged && a.acknowledgedAt);
    const responseTimes = acknowledgedAlerts.map(a => {
      return (a.acknowledgedAt!.getTime() - a.timestamp.getTime()) / (1000 * 60); // Minutes
    });
    const avgResponse = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    setStats({
      totalAlerts: total,
      unacknowledged: unack,
      criticalAlerts: critical,
      avgResponseTime: avgResponse
    });
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const alert = alerts.find(a => a.id === alertId);
      if (!alert) return;

      // Update local state
      const updatedAlerts = alerts.map(a => 
        a.id === alertId 
          ? { 
              ...a, 
              acknowledged: true, 
              acknowledgedAt: new Date(),
              acknowledgedBy: user?.email
            }
          : a
      );
      setAlerts(updatedAlerts);

      // Log acknowledgment
      auditLogger.log({
        event: alert.severity === 'critical' 
          ? AuditEventType.CRISIS_ACKNOWLEDGED 
          : AuditEventType.PHI_VIEW,
        action: `Alert acknowledged: ${alert.type}`,
        resource: 'supporter_alert',
        resourceId: alertId,
        userId: user?.id,
        details: {
          severity: alert.severity,
          responseTime: Math.round((Date.now() - alert.timestamp.getTime()) / (1000 * 60))
        }
      });

      // In production, send to API
      // await apiClient.acknowledgeAlert(alertId);
      
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unacknowledged') return !alert.acknowledged;
    if (filter === 'critical') return alert.severity === 'critical' || alert.severity === 'high';
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'crisis': return <AlertCircle className="text-red-500" size={20} />;
      case 'check_in_needed': return <Clock className="text-orange-500" size={20} />;
      case 'assessment_due': return <Activity className="text-blue-500" size={20} />;
      case 'milestone': return <TrendingUp className="text-green-500" size={20} />;
      default: return <Bell className="text-gray-500" size={20} />;
    }
  };

  const timeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Supporter Dashboard</h1>
        <p className="text-gray-600">
          Monitor and respond to patient support needs
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 mt-1" size={20} />
          <div>
            <p className="text-sm font-medium text-blue-900">Privacy Protection Active</p>
            <p className="text-xs text-blue-700 mt-1">
              Patient information is anonymized. You see initials only and non-PHI messages 
              to protect patient privacy while enabling support.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Bell className="text-purple-600" size={20} />
            <span className="text-2xl font-bold">{stats.totalAlerts}</span>
          </div>
          <p className="text-sm text-gray-600">Total Alerts</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="text-orange-600" size={20} />
            <span className="text-2xl font-bold">{stats.unacknowledged}</span>
          </div>
          <p className="text-sm text-gray-600">Unacknowledged</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-red-600" size={20} />
            <span className="text-2xl font-bold">{stats.criticalAlerts}</span>
          </div>
          <p className="text-sm text-gray-600">Critical/High</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-green-600" size={20} />
            <span className="text-2xl font-bold">{stats.avgResponseTime}m</span>
          </div>
          <p className="text-sm text-gray-600">Avg Response</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          All Alerts
        </button>
        <button
          onClick={() => setFilter('unacknowledged')}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'unacknowledged'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Unacknowledged ({stats.unacknowledged})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'critical'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Critical/High ({stats.criticalAlerts})
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'bg-white rounded-lg shadow-lg border-2 p-4 transition-all',
              getSeverityColor(alert.severity),
              !alert.acknowledged && alert.severity === 'critical' && 'animate-pulse'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getTypeIcon(alert.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold">
                        {alert.patientInitials}
                      </div>
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full uppercase',
                        getSeverityColor(alert.severity)
                      )}>
                        {alert.severity}
                      </span>
                    </div>
                    {alert.acknowledged && (
                      <CheckCircle className="text-green-500" size={16} />
                    )}
                  </div>
                  
                  <p className="font-medium text-gray-900 mb-1">
                    {alert.message}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{timeSince(alert.timestamp)}</span>
                    {alert.acknowledged && alert.acknowledgedAt && (
                      <>
                        <span>•</span>
                        <span>Acknowledged {timeSince(alert.acknowledgedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Acknowledge
                  </button>
                )}
                
                {alert.requiresAction && (
                  <Link
                    href={alert.actionUrl || '#'}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium text-center"
                  >
                    Take Action
                  </Link>
                )}
              </div>
            </div>

            {alert.severity === 'critical' && !alert.acknowledged && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <Info size={16} />
                  <span className="font-medium">Immediate attention required</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAlerts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Bell className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">No alerts matching your filter</p>
        </div>
      )}

      {/* Support Resources */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium mb-3">Quick Actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow transition-shadow">
            <Phone className="text-purple-600" size={20} />
            <div className="text-left">
              <p className="font-medium text-sm">Call Patient</p>
              <p className="text-xs text-gray-500">Initiate supportive call</p>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow transition-shadow">
            <MessageCircle className="text-blue-600" size={20} />
            <div className="text-left">
              <p className="font-medium text-sm">Send Message</p>
              <p className="text-xs text-gray-500">Non-urgent check-in</p>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow transition-shadow">
            <Shield className="text-green-600" size={20} />
            <div className="text-left">
              <p className="font-medium text-sm">Crisis Protocol</p>
              <p className="text-xs text-gray-500">Emergency procedures</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}