import { NextRequest, NextResponse } from 'next/server';

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

interface SupporterDashboardData {
  patients: SupportedPatient[];
  alerts: CrisisAlert[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SupporterDashboardData>>> {
  try {
    // In production, extract supporter ID from JWT token
    // const supporterId = extractSupporterIdFromToken(request);
    
    // Mock implementation for MVP
    // In production, these would be database queries:
    // - SELECT * FROM support_network WHERE supporter_id = ?
    // - JOIN with patients and daily_checkins tables
    // - SELECT * FROM crisis_alerts WHERE supporter_id IN (supporter_network)
    
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
        patientName: 'M.K.', // Use initials only for PHI compliance
        severity: 'high',
        message: 'Feeling overwhelmed and need immediate support',
        timestamp: '15 minutes ago',
        status: 'active'
      }
    ];

    const dashboardData: SupporterDashboardData = {
      patients: mockPatients,
      alerts: mockAlerts
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching supporter dashboard data:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}