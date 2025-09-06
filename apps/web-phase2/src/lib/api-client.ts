import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Check-in endpoints
  async submitCheckIn(data: any) {
    return this.client.post('/api/checkin', data);
  }

  async getCheckInHistory(limit = 30, offset = 0) {
    return this.client.get('/api/checkin/history', {
      params: { limit, offset },
    });
  }

  async getInsights() {
    return this.client.get('/api/checkin/insights');
  }

  async triggerCrisis(data: any) {
    return this.client.post('/api/checkin/crisis', data);
  }

  // Provider endpoints
  async getProviderDashboard() {
    return this.client.get('/api/provider/dashboard');
  }

  async getPatients(filters?: any) {
    return this.client.get('/api/provider/patients', { params: filters });
  }

  async getPatientDetails(patientId: string) {
    return this.client.get(`/api/provider/patient/${patientId}`);
  }

  async createCarePlan(data: any) {
    return this.client.post('/api/provider/care-plan', data);
  }

  async sendMessage(data: any) {
    return this.client.post('/api/provider/message', data);
  }

  async getAnalytics(startDate?: string, endDate?: string) {
    return this.client.get('/api/provider/analytics', {
      params: { startDate, endDate },
    });
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.client.post('/api/auth/login', { email, password });
  }

  async register(data: any) {
    return this.client.post('/api/auth/register', data);
  }

  async refreshToken() {
    return this.client.post('/api/auth/refresh');
  }

  async logout() {
    return this.client.post('/api/auth/logout');
  }

  // AI endpoints
  async sendPeerMessage(message: string) {
    return this.client.post('/api/ai/peer', { message });
  }

  async sendClinicalMessage(message: string) {
    return this.client.post('/api/ai/clinical', { message });
  }
}

export const apiClient = new ApiClient();