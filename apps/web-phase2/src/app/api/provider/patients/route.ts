import { NextRequest, NextResponse } from 'next/server';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  enrollmentDate: string;
  lastCheckIn?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  phq9Score?: number;
  gad7Score?: number;
  auditScore?: number;
  trend: 'improving' | 'stable' | 'declining';
  adherence: number;
  revenuePerMonth: number;
  nextAppointment?: string;
  hasActiveAlert?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Patient[]>>> {
  try {
    // In production, extract provider ID from JWT token
    // const providerId = extractProviderIdFromToken(request);
    
    // Mock implementation for MVP
    // In production, this would be a database query:
    // SELECT p.*, pa.*, dc.last_checkin, a.has_active_alert
    // FROM patients p
    // JOIN patient_assignments pa ON p.id = pa.patient_id
    // LEFT JOIN (
    //   SELECT patient_id, MAX(created_at) as last_checkin
    //   FROM daily_checkins 
    //   GROUP BY patient_id
    // ) dc ON p.id = dc.patient_id
    // LEFT JOIN (
    //   SELECT patient_id, COUNT(*) > 0 as has_active_alert
    //   FROM crisis_alerts 
    //   WHERE status = 'active'
    //   GROUP BY patient_id
    // ) a ON p.id = a.patient_id
    // WHERE pa.provider_id = ? AND pa.active = true
    
    const mockPatients: Patient[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        phone: '555-0101',
        enrollmentDate: '2024-01-15T00:00:00Z',
        lastCheckIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: 'low',
        phq9Score: 5,
        gad7Score: 4,
        auditScore: 2,
        trend: 'improving',
        adherence: 92,
        revenuePerMonth: 285,
        nextAppointment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        name: 'Michael Chen',
        email: 'mchen@example.com',
        phone: '555-0102',
        enrollmentDate: '2024-02-01T00:00:00Z',
        lastCheckIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
        enrollmentDate: '2023-12-10T00:00:00Z',
        lastCheckIn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: 'high',
        phq9Score: 18,
        gad7Score: 15,
        auditScore: 12,
        trend: 'declining',
        adherence: 45,
        revenuePerMonth: 385,
        nextAppointment: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        hasActiveAlert: true
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockPatients
    });

  } catch (error) {
    console.error('Error fetching provider patients:', error);
    
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