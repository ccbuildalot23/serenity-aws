import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

// Validation schemas
const patientAssignmentSchema = z.object({
  patientEmail: z.string().email(),
  careTeamRole: z.enum(['PRIMARY', 'SECONDARY', 'CONSULTANT']),
  notes: z.string().optional(),
});

const carePlanSchema = z.object({
  patientId: z.string(),
  goals: z.array(z.object({
    title: z.string(),
    description: z.string(),
    targetDate: z.string(),
    measurementCriteria: z.string(),
  })),
  interventions: z.array(z.string()),
  checkInFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY']),
  riskThresholds: z.object({
    moodAlert: z.number().min(1).max(10),
    anxietyAlert: z.number().min(1).max(10),
    cravingAlert: z.number().min(1).max(10),
  }),
});

const messageSchema = z.object({
  patientId: z.string(),
  message: z.string().min(1).max(1000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

// Mock data stores
const providerPatients = new Map();
const carePlans = new Map();
const messages = new Map();
const appointments = new Map();

/**
 * GET /api/provider/dashboard
 * Get provider dashboard data with ROI metrics
 */
router.get('/dashboard', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;
    const tenantId = req.user?.tenantId;
    
    if (!providerId) {
      return res.status(401).json({ error: 'Provider not authenticated' });
    }
    
    // Calculate ROI metrics
    const patients = providerPatients.get(providerId) || [];
    const totalPatients = patients.length;
    const activePatients = patients.filter((p: any) => p.status === 'ACTIVE').length;
    
    // CCM/BHI Billing Metrics
    const eligibleForCCM = Math.floor(activePatients * 0.7); // 70% meet CCM criteria
    const eligibleForBHI = Math.floor(activePatients * 0.5); // 50% meet BHI criteria
    const monthlyBillingPotential = (eligibleForCCM * 65) + (eligibleForBHI * 85); // Average reimbursement rates
    
    // Patient Retention Value
    const avgPatientValue = 4500; // $4,500 per patient per year
    const retentionRate = 0.85; // 85% with digital engagement
    const retentionValue = activePatients * avgPatientValue * retentionRate;
    
    // Crisis Prevention Metrics
    const crisisPreventions = Math.floor(activePatients * 0.15); // 15% crisis prevention rate
    const avgCrisisCost = 3000; // Average ER visit cost
    const crisisSavings = crisisPreventions * avgCrisisCost;
    
    // Efficiency Metrics
    const timePerPatientTraditional = 60; // minutes
    const timePerPatientDigital = 15; // minutes
    const timeSaved = activePatients * (timePerPatientTraditional - timePerPatientDigital);
    const hoursSaved = timeSaved / 60;
    const providerHourlyRate = 150;
    const efficiencySavings = hoursSaved * providerHourlyRate;
    
    const dashboardData = {
      overview: {
        totalPatients,
        activePatients,
        todayAppointments: 8,
        pendingMessages: 3,
        criticalAlerts: 1,
      },
      roiMetrics: {
        monthlyRevenue: {
          ccmBilling: eligibleForCCM * 65,
          bhiBilling: eligibleForBHI * 85,
          total: monthlyBillingPotential,
          increase: '+127%',
        },
        patientRetention: {
          rate: '85%',
          value: retentionValue,
          improvement: '+22%',
        },
        crisisPrevention: {
          prevented: crisisPreventions,
          savedCost: crisisSavings,
          reduction: '-43%',
        },
        efficiency: {
          hoursSaved: Math.round(hoursSaved),
          costSavings: Math.round(efficiencySavings),
          patientsPerDay: Math.round(activePatients / 20), // Working days
        },
        totalMonthlyROI: monthlyBillingPotential + Math.round(efficiencySavings / 12),
      },
      patientEngagement: {
        dailyCheckIns: Math.floor(activePatients * 0.75),
        weeklyActive: Math.floor(activePatients * 0.90),
        avgMoodScore: 6.8,
        avgComplianceRate: '78%',
      },
      alerts: [
        { id: '1', patient: 'John D.', type: 'CRISIS', message: 'Mood score 2/10', time: '10 min ago', severity: 'HIGH' },
        { id: '2', patient: 'Sarah M.', type: 'MISSED_CHECKIN', message: '3 days missed', time: '1 hour ago', severity: 'MEDIUM' },
        { id: '3', patient: 'Mike R.', type: 'MEDICATION', message: 'Non-compliant', time: '2 hours ago', severity: 'MEDIUM' },
      ],
      recentActivity: [
        { patient: 'Emma L.', action: 'Completed check-in', mood: 8, time: '5 min ago' },
        { patient: 'David K.', action: 'Scheduled appointment', date: 'Tomorrow 2pm', time: '15 min ago' },
        { patient: 'Lisa T.', action: 'Message sent', preview: 'Feeling better today...', time: '30 min ago' },
      ],
    };
    
    res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * GET /api/provider/patients
 * Get provider's patient list
 */
router.get('/patients', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;
    const { status, risk, search } = req.query;
    
    if (!providerId) {
      return res.status(401).json({ error: 'Provider not authenticated' });
    }
    
    let patients = providerPatients.get(providerId) || [];
    
    // Filter by status
    if (status) {
      patients = patients.filter((p: any) => p.status === status);
    }
    
    // Filter by risk level
    if (risk) {
      patients = patients.filter((p: any) => p.riskLevel === risk);
    }
    
    // Search by name or email
    if (search) {
      const searchLower = String(search).toLowerCase();
      patients = patients.filter((p: any) => 
        p.name.toLowerCase().includes(searchLower) ||
        p.email.toLowerCase().includes(searchLower)
      );
    }
    
    // Add mock data if empty
    if (patients.length === 0) {
      patients = [
        {
          id: '1',
          name: 'John Doe',
          email: 'john.doe@example.com',
          status: 'ACTIVE',
          riskLevel: 'LOW',
          lastCheckIn: '2024-01-10T10:00:00Z',
          adherence: 85,
          moodTrend: 'improving',
          nextAppointment: '2024-01-15T14:00:00Z',
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          status: 'ACTIVE',
          riskLevel: 'MEDIUM',
          lastCheckIn: '2024-01-09T08:00:00Z',
          adherence: 70,
          moodTrend: 'stable',
          nextAppointment: '2024-01-12T10:00:00Z',
        },
      ];
      providerPatients.set(providerId, patients);
    }
    
    res.json({
      success: true,
      patients,
      total: patients.length,
    });
  } catch (error: any) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to retrieve patients' });
  }
});

/**
 * GET /api/provider/patient/:patientId
 * Get detailed patient information
 */
router.get('/patient/:patientId', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const providerId = req.user?.id;
    
    // Verify provider has access to this patient
    const patients = providerPatients.get(providerId) || [];
    const patient = patients.find((p: any) => p.id === patientId);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found or access denied' });
    }
    
    // Get patient's care plan
    const carePlan = carePlans.get(patientId);
    
    // Mock detailed data
    const patientDetails = {
      ...patient,
      demographics: {
        age: 34,
        gender: 'Male',
        phone: '+1 (555) 123-4567',
        emergencyContact: 'Sarah Doe (Wife)',
        insurance: 'Blue Cross Blue Shield',
      },
      clinicalInfo: {
        diagnosis: ['Major Depressive Disorder', 'Generalized Anxiety Disorder'],
        medications: ['Sertraline 100mg daily', 'Trazodone 50mg as needed'],
        allergies: ['Penicillin'],
        lastVisit: '2024-01-05',
        provider: 'Dr. Smith',
      },
      checkInHistory: {
        last7Days: {
          completed: 6,
          missed: 1,
          avgMood: 6.5,
          avgAnxiety: 5.2,
          avgSleep: 7.1,
        },
        last30Days: {
          completed: 25,
          missed: 5,
          avgMood: 6.2,
          avgAnxiety: 5.8,
          avgSleep: 6.8,
        },
      },
      carePlan: carePlan || {
        goals: [
          { title: 'Improve mood stability', progress: 65 },
          { title: 'Reduce anxiety episodes', progress: 45 },
          { title: 'Establish sleep routine', progress: 80 },
        ],
        nextSteps: [
          'Continue current medication regimen',
          'Weekly therapy sessions',
          'Daily mood tracking',
        ],
      },
      riskFactors: [
        'Family history of depression',
        'Recent job loss',
        'Social isolation',
      ],
      protectiveFactors: [
        'Strong family support',
        'Regular exercise',
        'Engaged in treatment',
      ],
    };
    
    // Log PHI access
    console.log(`PHI accessed: Provider ${providerId} viewed patient ${patientId}`);
    
    res.json({
      success: true,
      patient: patientDetails,
    });
  } catch (error: any) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to retrieve patient information' });
  }
});

/**
 * POST /api/provider/patient
 * Assign a patient to provider
 */
router.post('/patient', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const validatedData = patientAssignmentSchema.parse(req.body);
    const providerId = req.user?.id;
    
    if (!providerId) {
      return res.status(401).json({ error: 'Provider not authenticated' });
    }
    
    const patientId = crypto.randomUUID();
    const assignment = {
      id: patientId,
      ...validatedData,
      providerId,
      assignedAt: new Date().toISOString(),
      status: 'ACTIVE',
      name: validatedData.patientEmail.split('@')[0], // Temporary
      email: validatedData.patientEmail,
      riskLevel: 'LOW',
    };
    
    if (!providerPatients.has(providerId)) {
      providerPatients.set(providerId, []);
    }
    providerPatients.get(providerId).push(assignment);
    
    // Log audit event
    console.log(`Patient assigned: Provider ${providerId}, Patient ${validatedData.patientEmail}`);
    
    res.status(201).json({
      success: true,
      patientId,
      message: 'Patient assigned successfully',
    });
  } catch (error: any) {
    console.error('Assign patient error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to assign patient' });
  }
});

/**
 * POST /api/provider/care-plan
 * Create or update care plan
 */
router.post('/care-plan', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const validatedData = carePlanSchema.parse(req.body);
    const providerId = req.user?.id;
    
    // Verify provider has access to this patient
    const patients = providerPatients.get(providerId) || [];
    const hasAccess = patients.some((p: any) => p.id === validatedData.patientId);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this patient' });
    }
    
    const carePlanId = crypto.randomUUID();
    const carePlan = {
      id: carePlanId,
      ...validatedData,
      providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    carePlans.set(validatedData.patientId, carePlan);
    
    // Log audit event
    console.log(`Care plan created: Provider ${providerId}, Patient ${validatedData.patientId}`);
    
    res.status(201).json({
      success: true,
      carePlanId,
      message: 'Care plan created successfully',
    });
  } catch (error: any) {
    console.error('Care plan error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create care plan' });
  }
});

/**
 * POST /api/provider/message
 * Send secure message to patient
 */
router.post('/message', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const validatedData = messageSchema.parse(req.body);
    const providerId = req.user?.id;
    
    // Verify provider has access to this patient
    const patients = providerPatients.get(providerId) || [];
    const patient = patients.find((p: any) => p.id === validatedData.patientId);
    
    if (!patient) {
      return res.status(403).json({ error: 'Access denied to this patient' });
    }
    
    const messageId = crypto.randomUUID();
    const message = {
      id: messageId,
      ...validatedData,
      providerId,
      providerName: req.user?.email,
      sentAt: new Date().toISOString(),
      read: false,
      encrypted: true, // In production, actually encrypt
    };
    
    if (!messages.has(validatedData.patientId)) {
      messages.set(validatedData.patientId, []);
    }
    messages.get(validatedData.patientId).push(message);
    
    // Log audit event
    console.log(`Secure message sent: Provider ${providerId} to Patient ${validatedData.patientId}`);
    
    res.status(201).json({
      success: true,
      messageId,
      message: 'Message sent securely',
    });
  } catch (error: any) {
    console.error('Message error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /api/provider/analytics
 * Get practice analytics
 */
router.get('/analytics', AuthService.authenticate, AuthService.authorize('PROVIDER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;
    const { startDate, endDate } = req.query;
    
    const analytics = {
      patientOutcomes: {
        improved: 65,
        stable: 25,
        declined: 10,
      },
      engagementMetrics: {
        dailyCheckInRate: 75,
        appointmentAttendance: 88,
        medicationAdherence: 82,
        averageResponseTime: 4.2, // hours
      },
      clinicalMetrics: {
        avgMoodImprovement: 23,
        avgAnxietyReduction: 31,
        crisisInterventions: 8,
        hospitalizations: 2,
      },
      financialMetrics: {
        monthlyRevenue: 45000,
        reimbursementRate: 92,
        outstandingClaims: 5,
        ccmBillings: 120,
        bhiBillings: 85,
      },
      trends: {
        mood: [6.2, 6.5, 6.8, 6.7, 7.1, 7.3],
        anxiety: [5.8, 5.5, 5.2, 5.3, 4.9, 4.7],
        engagement: [70, 72, 75, 74, 78, 79],
      },
    };
    
    res.json({
      success: true,
      analytics,
      period: {
        start: startDate || '2024-01-01',
        end: endDate || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

export default router;