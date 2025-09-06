import request from 'supertest';
import express from 'express';

// Mock authentication middleware
jest.mock('../services/auth.service', () => ({
  AuthService: {
    authenticate: jest.fn((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      // Check token to determine role
      if (authHeader.includes('provider-token')) {
        req.user = {
          id: 'provider-id',
          email: 'provider@example.com',
          role: 'PROVIDER',
          tenantId: 'test-tenant',
        };
      } else if (authHeader.includes('admin-token')) {
        req.user = {
          id: 'admin-id',
          email: 'admin@example.com',
          role: 'ADMIN',
          tenantId: 'test-tenant',
        };
      } else {
        req.user = {
          id: 'patient-id',
          email: 'patient@example.com',
          role: 'PATIENT',
          tenantId: 'test-tenant',
        };
      }
      next();
    }),
    authorize: jest.fn((...roles) => (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    }),
    requireRecentAuth: jest.fn(() => (req, res, next) => next()),
  },
}));

describe('Provider Dashboard API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up
    const providerRoutes = require('../routes/provider.routes').default;
    app.use('/api/provider', providerRoutes);
  });

  describe('GET /api/provider/dashboard', () => {
    it('should return dashboard data for providers', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.dashboard).toHaveProperty('overview');
      expect(response.body.dashboard).toHaveProperty('roiMetrics');
      expect(response.body.dashboard).toHaveProperty('patientEngagement');
      expect(response.body.dashboard).toHaveProperty('alerts');
    });

    it('should return ROI metrics', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      const { roiMetrics } = response.body.dashboard;
      expect(roiMetrics).toHaveProperty('monthlyRevenue');
      expect(roiMetrics.monthlyRevenue).toHaveProperty('ccmBilling');
      expect(roiMetrics.monthlyRevenue).toHaveProperty('bhiBilling');
      expect(roiMetrics).toHaveProperty('patientRetention');
      expect(roiMetrics).toHaveProperty('crisisPrevention');
      expect(roiMetrics).toHaveProperty('efficiency');
      expect(roiMetrics).toHaveProperty('totalMonthlyROI');
    });

    it('should deny access to patients', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer patient-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });

    it('should allow access to admins', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token provided');
    });
  });

  describe('GET /api/provider/patients', () => {
    it('should return patient list', async () => {
      const response = await request(app)
        .get('/api/provider/patients')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('patients');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.patients)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/provider/patients?status=ACTIVE')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      response.body.patients.forEach(patient => {
        expect(patient.status).toBe('ACTIVE');
      });
    });

    it('should filter by risk level', async () => {
      const response = await request(app)
        .get('/api/provider/patients?risk=HIGH')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      // Note: May return empty if no high risk patients
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/provider/patients?search=john')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/provider/patient/:patientId', () => {
    it('should return detailed patient information', async () => {
      // First, create a patient assignment
      await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'patient@example.com',
          careTeamRole: 'PRIMARY',
          notes: 'Initial assessment',
        });

      const response = await request(app)
        .get('/api/provider/patient/1')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.patient).toHaveProperty('demographics');
      expect(response.body.patient).toHaveProperty('clinicalInfo');
      expect(response.body.patient).toHaveProperty('checkInHistory');
      expect(response.body.patient).toHaveProperty('carePlan');
      expect(response.body.patient).toHaveProperty('riskFactors');
      expect(response.body.patient).toHaveProperty('protectiveFactors');
    });

    it('should deny access to unassigned patients', async () => {
      const response = await request(app)
        .get('/api/provider/patient/999')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Patient not found or access denied');
    });
  });

  describe('POST /api/provider/patient', () => {
    it('should assign a patient to provider', async () => {
      const response = await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'newpatient@example.com',
          careTeamRole: 'PRIMARY',
          notes: 'New patient intake',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('patientId');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'invalid-email',
          careTeamRole: 'PRIMARY',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate care team role', async () => {
      const response = await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'patient@example.com',
          careTeamRole: 'INVALID_ROLE',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /api/provider/care-plan', () => {
    const validCarePlan = {
      patientId: '1',
      goals: [
        {
          title: 'Improve mood stability',
          description: 'Achieve consistent mood scores above 6',
          targetDate: '2025-12-31',
          measurementCriteria: 'Daily mood scores',
        },
      ],
      interventions: ['CBT therapy', 'Medication management'],
      checkInFrequency: 'DAILY',
      riskThresholds: {
        moodAlert: 4,
        anxietyAlert: 7,
        cravingAlert: 7,
      },
    };

    it('should create a care plan', async () => {
      // First assign patient
      await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'patient@example.com',
          careTeamRole: 'PRIMARY',
        });

      const response = await request(app)
        .post('/api/provider/care-plan')
        .set('Authorization', 'Bearer provider-token')
        .send(validCarePlan);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('carePlanId');
    });

    it('should validate check-in frequency', async () => {
      const response = await request(app)
        .post('/api/provider/care-plan')
        .set('Authorization', 'Bearer provider-token')
        .send({
          ...validCarePlan,
          checkInFrequency: 'INVALID',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate risk thresholds', async () => {
      const response = await request(app)
        .post('/api/provider/care-plan')
        .set('Authorization', 'Bearer provider-token')
        .send({
          ...validCarePlan,
          riskThresholds: {
            moodAlert: 11, // Invalid: > 10
            anxietyAlert: 7,
            cravingAlert: 7,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /api/provider/message', () => {
    it('should send secure message to patient', async () => {
      // First assign patient
      await request(app)
        .post('/api/provider/patient')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientEmail: 'patient@example.com',
          careTeamRole: 'PRIMARY',
        });

      const response = await request(app)
        .post('/api/provider/message')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientId: '1',
          message: 'Please schedule your next appointment',
          priority: 'MEDIUM',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messageId');
    });

    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(1001);
      const response = await request(app)
        .post('/api/provider/message')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientId: '1',
          message: longMessage,
          priority: 'HIGH',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate priority levels', async () => {
      const response = await request(app)
        .post('/api/provider/message')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientId: '1',
          message: 'Test message',
          priority: 'INVALID',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should deny access to unassigned patients', async () => {
      const response = await request(app)
        .post('/api/provider/message')
        .set('Authorization', 'Bearer provider-token')
        .send({
          patientId: '999',
          message: 'Test message',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied to this patient');
    });
  });

  describe('GET /api/provider/analytics', () => {
    it('should return practice analytics', async () => {
      const response = await request(app)
        .get('/api/provider/analytics')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.analytics).toHaveProperty('patientOutcomes');
      expect(response.body.analytics).toHaveProperty('engagementMetrics');
      expect(response.body.analytics).toHaveProperty('clinicalMetrics');
      expect(response.body.analytics).toHaveProperty('financialMetrics');
      expect(response.body.analytics).toHaveProperty('trends');
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/provider/analytics?startDate=2025-01-01&endDate=2025-12-31')
        .set('Authorization', 'Bearer provider-token');

      expect(response.status).toBe(200);
      expect(response.body.period).toHaveProperty('start', '2025-01-01');
      expect(response.body.period).toHaveProperty('end', '2025-12-31');
    });

    it('should calculate financial metrics', async () => {
      const response = await request(app)
        .get('/api/provider/analytics')
        .set('Authorization', 'Bearer provider-token');

      const { financialMetrics } = response.body.analytics;
      expect(financialMetrics).toHaveProperty('monthlyRevenue');
      expect(financialMetrics).toHaveProperty('reimbursementRate');
      expect(financialMetrics).toHaveProperty('ccmBillings');
      expect(financialMetrics).toHaveProperty('bhiBillings');
      expect(typeof financialMetrics.monthlyRevenue).toBe('number');
    });
  });

  describe('ROI Calculations', () => {
    it('should calculate CCM billing potential', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      const { roiMetrics } = response.body.dashboard;
      expect(roiMetrics.monthlyRevenue.ccmBilling).toBeGreaterThanOrEqual(0);
      // CCM rate is $65 per eligible patient
    });

    it('should calculate BHI billing potential', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      const { roiMetrics } = response.body.dashboard;
      expect(roiMetrics.monthlyRevenue.bhiBilling).toBeGreaterThanOrEqual(0);
      // BHI rate is $85 per eligible patient
    });

    it('should calculate efficiency savings', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      const { roiMetrics } = response.body.dashboard;
      expect(roiMetrics.efficiency).toHaveProperty('hoursSaved');
      expect(roiMetrics.efficiency).toHaveProperty('costSavings');
      expect(roiMetrics.efficiency.hoursSaved).toBeGreaterThanOrEqual(0);
    });

    it('should calculate crisis prevention value', async () => {
      const response = await request(app)
        .get('/api/provider/dashboard')
        .set('Authorization', 'Bearer provider-token');

      const { roiMetrics } = response.body.dashboard;
      expect(roiMetrics.crisisPrevention).toHaveProperty('prevented');
      expect(roiMetrics.crisisPrevention).toHaveProperty('savedCost');
      expect(roiMetrics.crisisPrevention).toHaveProperty('reduction');
    });
  });
});