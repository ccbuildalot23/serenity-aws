'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Heart, 
  AlertTriangle, 
  MessageCircle, 
  Phone,
  Clock,
  TrendingUp,
  CheckCircle,
  User
} from 'lucide-react';
import { withSupporterAuth } from '@/hoc/withAuth';
import { useAuth } from '@/providers/AuthProvider';
import SessionTimeout from '@/components/compliance/SessionTimeout';

interface SupportedPatient {
  id: string;
  firstName: string;
  lastCheckIn: string;
  riskLevel: 'low' | 'medium' | 'high';
  checkInStreak: number;
  recentTrend: 'improving' | 'stable' | 'declining';
}

interface CrisisAlert {
  id: string;
  patientName: string;
  severity: 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

function SupporterDashboard(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<SupportedPatient[]>([]);
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSupporterData = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API calls
        // const [patientsResponse, alertsResponse] = await Promise.all([
        //   fetch('/api/supporter/patients'),
        //   fetch('/api/supporter/alerts')
        // ]);
        
        // Mock data for MVP
        const mockPatients: SupportedPatient[] = [
          {
            id: '1',
            firstName: 'Sarah',
            lastCheckIn: '2 hours ago',
            riskLevel: 'low',
            checkInStreak: 7,
            recentTrend: 'improving'
          },
          {
            id: '2',
            firstName: 'Mike',
            lastCheckIn: '1 day ago',
            riskLevel: 'medium',
            checkInStreak: 3,
            recentTrend: 'stable'
          },
          {
            id: '3',
            firstName: 'Alex',
            lastCheckIn: '6 hours ago',
            riskLevel: 'low',
            checkInStreak: 12,
            recentTrend: 'improving'
          }
        ];

        const mockAlerts: CrisisAlert[] = [
          {
            id: '1',
            patientName: 'M.K.',
            severity: 'high',
            message: 'Feeling overwhelmed and need immediate support',
            timestamp: '15 minutes ago',
            status: 'active'
          }
        ];

        setPatients(mockPatients);
        setAlerts(mockAlerts);
      } catch (error) {
        console.error('Failed to load supporter data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSupporterData();
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      default: return 'green';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="text-green-500" size={16} />;
      case 'declining': return <TrendingUp className="text-red-500 rotate-180" size={16} />;
      default: return <TrendingUp className="text-gray-500" size={16} />;
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      // TODO: Call API to acknowledge alert
      // await fetch(`/api/supporter/alerts/${alertId}/acknowledge`, { method: 'POST' });
      
      setAlerts(alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged' as const }
          : alert
      ));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

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
            Support Network Dashboard
          </h1>
          <p className="text-gray-600">
            Welcome, {user?.name || 'Supporter'}. Here's an overview of your supported individuals.
          </p>
        </div>

        {/* Active Alerts */}
        {alerts.filter(alert => alert.status === 'active').length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={24} />
              <h2 className="text-xl font-semibold text-red-900">Active Crisis Alerts</h2>
            </div>
            <div className="space-y-4">
              {alerts
                .filter(alert => alert.status === 'active')
                .map(alert => (
                  <div key={alert.id} className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{alert.patientName}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {alert.severity} priority
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">{alert.message}</p>
                        <p className="text-sm text-gray-500">
                          <Clock className="inline w-4 h-4 mr-1" />
                          {alert.timestamp}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          <CheckCircle className="inline w-4 h-4 mr-1" />
                          Acknowledge
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                          <Phone className="inline w-4 h-4 mr-1" />
                          Call
                        </button>
                        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                          <MessageCircle className="inline w-4 h-4 mr-1" />
                          Message
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Supported Individuals */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Supported Individuals</h2>
          <div className="grid gap-4">
            {patients.map(patient => (
              <div key={patient.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{patient.firstName}</h3>
                      <p className="text-sm text-gray-600">Last check-in: {patient.lastCheckIn}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{patient.checkInStreak}</div>
                      <div className="text-xs text-gray-500">day streak</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(patient.recentTrend)}
                      <span className="text-sm capitalize text-gray-600">{patient.recentTrend}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium bg-${getRiskColor(patient.riskLevel)}-100 text-${getRiskColor(patient.riskLevel)}-800`}>
                      {patient.riskLevel} risk
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Support Resources */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Crisis Response Guide</h3>
              <p className="text-sm text-gray-600 mb-3">
                Step-by-step guide for responding to crisis alerts effectively.
              </p>
              <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                View Guide →
              </button>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Emergency Contacts</h3>
              <p className="text-sm text-gray-600 mb-3">
                Quick access to mental health emergency services and hotlines.
              </p>
              <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                View Contacts →
              </button>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Training Materials</h3>
              <p className="text-sm text-gray-600 mb-3">
                Learn effective support techniques and communication strategies.
              </p>
              <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                View Training →
              </button>
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

export default withSupporterAuth(SupporterDashboard);