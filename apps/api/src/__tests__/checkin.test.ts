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
      
      const token = authHeader.replace('Bearer ', '');
      // Different users for different tokens
      let userId = 'test-user-id';
      let email = 'test@example.com';
      
      if (token === 'new-user-token') {
        userId = 'new-user-id';
        email = 'newuser@example.com';
      }
      
      req.user = {
        id: userId,
        email: email,
        role: 'PATIENT',
        tenantId: 'test-tenant',
      };
      next();
    }),
    authorize: jest.fn(() => (req, res, next) => next()),
  },
}));

describe('Check-in API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up
    const checkinRoutes = require('../routes/checkin.routes').default;
    app.use('/api/checkin', checkinRoutes);
  });

  describe('POST /api/checkin', () => {
    const validCheckIn = {
      mood: 7,
      anxiety: 3,
      sleepHours: 8,
      sleepQuality: 8,
      medication: true,
      exercise: true,
      socialInteraction: true,
      substanceUse: false,
      cravingIntensity: 2,
      triggers: ['work stress'],
      copingStrategiesUsed: ['meditation', 'exercise'],
      gratitude: 'Grateful for supportive family',
      notes: 'Feeling better today',
      supportNeeded: false,
      crisisFlag: false,
    };

    it('should submit a valid check-in', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send(validCheckIn);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('checkInId');
      expect(response.body).toHaveProperty('insights');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject check-in without authentication', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .send(validCheckIn);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token provided');
    });

    it('should validate mood range (1-10)', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, mood: 11 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate anxiety range (1-10)', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, anxiety: 0 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate sleep hours (0-24)', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, sleepHours: 25 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should trigger crisis alert for low mood', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, mood: 2 });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('high');
    });

    it('should trigger crisis alert for high anxiety', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, anxiety: 9 });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('high');
    });

    it('should trigger crisis alert with crisis flag', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCheckIn, crisisFlag: true });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('critical');
    });
  });

  describe('GET /api/checkin/history', () => {
    it('should retrieve check-in history', async () => {
      // First submit a check-in
      await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({
          mood: 7,
          anxiety: 3,
          sleepHours: 8,
          sleepQuality: 8,
          medication: true,
          exercise: true,
          socialInteraction: true,
          substanceUse: false,
          cravingIntensity: 2,
        });

      const response = await request(app)
        .get('/api/checkin/history')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('checkIns');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.checkIns)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/checkin/history?limit=10&offset=0')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/checkin/history');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token provided');
    });
  });

  describe('GET /api/checkin/insights', () => {
    it('should generate personalized insights', async () => {
      // Submit multiple check-ins
      for (let i = 0; i < 7; i++) {
        await request(app)
          .post('/api/checkin')
          .set('Authorization', 'Bearer valid-token')
          .send({
            mood: 6 + i % 3,
            anxiety: 4 - i % 2,
            sleepHours: 7 + i % 2,
            sleepQuality: 7,
            medication: true,
            exercise: i % 2 === 0,
            socialInteraction: true,
            substanceUse: false,
            cravingIntensity: 3 - i % 3,
          });
      }

      const response = await request(app)
        .get('/api/checkin/insights')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.insights).toHaveProperty('currentStreak');
      expect(response.body.insights).toHaveProperty('moodAverage');
      expect(response.body.insights).toHaveProperty('anxietyAverage');
      expect(response.body.insights).toHaveProperty('sleepAverage');
      expect(response.body.insights).toHaveProperty('patterns');
      expect(response.body.insights).toHaveProperty('recommendations');
    });

    it('should handle no check-in history', async () => {
      const response = await request(app)
        .get('/api/checkin/insights')
        .set('Authorization', 'Bearer new-user-token');

      expect(response.status).toBe(200);
      expect(response.body.insights).toHaveProperty('streakDays', 0);
      expect(response.body.insights).toHaveProperty('message');
    });
  });

  describe('POST /api/checkin/emergency-contacts', () => {
    const validContact = {
      name: 'Jane Doe',
      phone: '+1-555-123-4567',
      email: 'jane@example.com',
      relationship: 'Spouse',
      isPrimary: true,
      canReceiveCrisisAlerts: true,
    };

    it('should add emergency contact', async () => {
      const response = await request(app)
        .post('/api/checkin/emergency-contacts')
        .set('Authorization', 'Bearer valid-token')
        .send(validContact);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('contactId');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/checkin/emergency-contacts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'John',
          // missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/checkin/emergency-contacts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...validContact,
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/checkin/emergency-contacts', () => {
    it('should retrieve emergency contacts', async () => {
      // First add a contact
      await request(app)
        .post('/api/checkin/emergency-contacts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Emergency Contact',
          phone: '+1-555-999-8888',
          relationship: 'Friend',
          isPrimary: false,
          canReceiveCrisisAlerts: true,
        });

      const response = await request(app)
        .get('/api/checkin/emergency-contacts')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('contacts');
      expect(Array.isArray(response.body.contacts)).toBe(true);
    });
  });

  describe('POST /api/checkin/crisis', () => {
    it('should trigger crisis support', async () => {
      const response = await request(app)
        .post('/api/checkin/crisis')
        .set('Authorization', 'Bearer valid-token')
        .send({
          message: 'Need immediate help',
          severity: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('crisisId');
      expect(response.body).toHaveProperty('supportResources');
      expect(Array.isArray(response.body.supportResources)).toBe(true);
    });

    it('should work without message', async () => {
      const response = await request(app)
        .post('/api/checkin/crisis')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/checkin/crisis')
        .send({
          message: 'Need help',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token provided');
    });
  });

  describe('Risk Assessment', () => {
    it('should calculate low risk for positive metrics', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({
          mood: 8,
          anxiety: 2,
          sleepHours: 8,
          sleepQuality: 9,
          medication: true,
          exercise: true,
          socialInteraction: true,
          substanceUse: false,
          cravingIntensity: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('low');
    });

    it('should calculate moderate risk for mixed metrics', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({
          mood: 5,
          anxiety: 6,
          sleepHours: 5,
          sleepQuality: 5,
          medication: true,
          exercise: false,
          socialInteraction: false,
          substanceUse: false,
          cravingIntensity: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('moderate');
    });

    it('should calculate high risk for concerning metrics', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Authorization', 'Bearer valid-token')
        .send({
          mood: 3,
          anxiety: 8,
          sleepHours: 3,
          sleepQuality: 2,
          medication: false,
          exercise: false,
          socialInteraction: false,
          substanceUse: true,
          cravingIntensity: 8,
        });

      expect(response.status).toBe(201);
      expect(response.body.insights.riskLevel).toBe('high');
    });
  });
});