'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search,
  Filter,
  ChevronRight,
  AlertCircle,
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  Mail,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import SessionTimeout from '@/components/compliance/SessionTimeout';
import { useRouter } from 'next/navigation';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  enrollmentDate: Date;
  lastCheckIn?: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  phq9Score?: number;
  gad7Score?: number;
  auditScore?: number;
  trend: 'improving' | 'stable' | 'declining';
  adherence: number;
  revenuePerMonth: number;
  nextAppointment?: Date;
  hasActiveAlert?: boolean;
}

// Mock data for demonstration
const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '555-0101',
    enrollmentDate: new Date('2024-01-15'),
    lastCheckIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    riskLevel: 'low',
    phq9Score: 5,
    gad7Score: 4,
    auditScore: 2,
    trend: 'improving',
    adherence: 92,
    revenuePerMonth: 285,
    nextAppointment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: 'Michael Chen',
    email: 'mchen@example.com',
    phone: '555-0102',
    enrollmentDate: new Date('2024-02-01'),
    lastCheckIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    riskLevel: 'medium',
    phq9Score: 12,
    gad7Score: 10,
    auditScore: 8,
    trend: 'stable',
    adherence: 78,
    revenuePerMonth: 265,
    hasActiveAlert: true
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    email: 'emily.r@example.com',
    phone: '555-0103',
    enrollmentDate: new Date('2023-12-10'),
    lastCheckIn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    riskLevel: 'high',
    phq9Score: 18,
    gad7Score: 15,
    auditScore: 12,
    trend: 'declining',
    adherence: 45,
    revenuePerMonth: 385,
    nextAppointment: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    hasActiveAlert: true
  },
  {
    id: '4',
    name: 'James Wilson',
    email: 'jwilson@example.com',
    enrollmentDate: new Date('2024-03-05'),
    lastCheckIn: new Date(),
    riskLevel: 'low',
    phq9Score: 3,
    gad7Score: 2,
    auditScore: 0,
    trend: 'stable',
    adherence: 100,
    revenuePerMonth: 165
  },
  {
    id: '5',
    name: 'Lisa Anderson',
    email: 'lisa.a@example.com',
    phone: '555-0105',
    enrollmentDate: new Date('2024-01-20'),
    lastCheckIn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    riskLevel: 'critical',
    phq9Score: 22,
    gad7Score: 18,
    auditScore: 25,
    trend: 'declining',
    adherence: 23,
    revenuePerMonth: 465,
    hasActiveAlert: true
  }
];

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useStore();
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [loading, setLoading] = useState<boolean>(false);

  // Filter and sort patients
  const filteredPatients = patients
    .filter(patient => {
      const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           patient.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = filterRisk === 'all' || patient.riskLevel === filterRisk;
      return matchesSearch && matchesRisk;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'risk':
          const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        case 'lastCheckIn':
          return (b.lastCheckIn?.getTime() || 0) - (a.lastCheckIn?.getTime() || 0);
        case 'revenue':
          return b.revenuePerMonth - a.revenuePerMonth;
        default:
          return 0;
      }
    });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRiskBadge = (risk: string) => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return colors[risk as keyof typeof colors] || colors.low;
  };

  const daysSinceLastCheckIn = (date?: Date) => {
    if (!date) return null;
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Patient Management</h1>
        <p className="text-gray-600">
          Monitor patient progress, risk levels, and engagement
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-purple-600" size={20} />
            <span className="text-2xl font-bold">{patients.length}</span>
          </div>
          <p className="text-sm text-gray-600">Total Patients</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-2xl font-bold">
              {patients.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length}
            </span>
          </div>
          <p className="text-sm text-gray-600">At Risk</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-green-600" size={20} />
            <span className="text-2xl font-bold">
              {Math.round(patients.reduce((sum, p) => sum + p.adherence, 0) / patients.length)}%
            </span>
          </div>
          <p className="text-sm text-gray-600">Avg Adherence</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-blue-600" size={20} />
            <span className="text-2xl font-bold">
              ${patients.reduce((sum, p) => sum + p.revenuePerMonth, 0).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-600">Monthly Revenue</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="name">Sort by Name</option>
            <option value="risk">Sort by Risk</option>
            <option value="lastCheckIn">Sort by Last Check-in</option>
            <option value="revenue">Sort by Revenue</option>
          </select>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((patient) => {
                const daysSince = daysSinceLastCheckIn(patient.lastCheckIn);
                return (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {patient.name}
                            {patient.hasActiveAlert && (
                              <AlertCircle className="text-red-500 animate-pulse" size={16} />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{patient.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        getRiskBadge(patient.riskLevel)
                      )}>
                        {patient.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-1">
                        {patient.phq9Score !== undefined && (
                          <div>PHQ-9: {patient.phq9Score}</div>
                        )}
                        {patient.gad7Score !== undefined && (
                          <div>GAD-7: {patient.gad7Score}</div>
                        )}
                        {patient.auditScore !== undefined && (
                          <div>AUDIT: {patient.auditScore}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {patient.lastCheckIn ? (
                          <>
                            {daysSince === 0 ? 'Today' : 
                             daysSince === 1 ? 'Yesterday' : 
                             `${daysSince} days ago`}
                            {daysSince && daysSince > 7 && (
                              <span className="ml-1 text-red-600">⚠</span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-500">Never</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {patient.adherence}% adherence
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(patient.trend)}
                        <span className="text-sm text-gray-600 capitalize">
                          {patient.trend}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${patient.revenuePerMonth}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/provider/patients/${patient.id}`}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          View
                        </Link>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredPatients.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">No patients found matching your criteria</p>
        </div>
      )}

      {/* Session Timeout Component */}
      <SessionTimeout
        timeoutMinutes={15}
        warningMinutes={2}
        onTimeout={() => router.push('/login?reason=timeout')}
      />
    </div>
  );
}