/**
 * API Service Layer with Cognito Authentication
 * Handles all authenticated API calls to AWS backend
 */

import { toast } from 'sonner';

// Types
interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
}

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiService {
  private config: ApiConfig;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };
    
    // Load tokens from storage on init
    this.loadTokens();
  }

  /**
   * Load tokens from secure storage
   */
  private loadTokens(): void {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      try {
        const tokens = JSON.parse(stored);
        // Check if tokens are still valid
        if (tokens.expiresAt > Date.now()) {
          this.tokens = tokens;
        } else {
          // Clear expired tokens
          localStorage.removeItem('auth_tokens');
        }
      } catch (e) {
        console.error('Failed to parse stored tokens:', e);
        localStorage.removeItem('auth_tokens');
      }
    }
  }

  /**
   * Save tokens to secure storage
   */
  private saveTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    
    this.tokens = tokens;
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  /**
   * Clear tokens on logout
   */
  public clearTokens(): void {
    this.tokens = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_tokens');
    }
  }

  /**
   * Set tokens after Cognito authentication
   */
  public setTokens(idToken: string, accessToken: string, refreshToken: string, expiresIn: number): void {
    const tokens: AuthTokens = {
      idToken,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
    this.saveTokens(tokens);
  }

  /**
   * Refresh tokens using refresh token
   */
  private async refreshTokens(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        // In production, this would call Cognito's token endpoint
        // For now, return mock refreshed tokens
        const mockRefreshedTokens: AuthTokens = {
          idToken: 'refreshed-id-token',
          accessToken: 'refreshed-access-token',
          refreshToken: this.tokens.refreshToken,
          expiresAt: Date.now() + (3600 * 1000) // 1 hour
        };

        this.saveTokens(mockRefreshedTokens);
        return mockRefreshedTokens;
      } catch (error) {
        // Clear tokens on refresh failure
        this.clearTokens();
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Get valid auth token, refreshing if needed
   */
  private async getAuthToken(): Promise<string> {
    // Check if tokens exist
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (this.tokens.expiresAt < Date.now() + bufferTime) {
      try {
        await this.refreshTokens();
      } catch (error) {
        throw new Error('Session expired. Please login again.');
      }
    }

    return this.tokens.idToken;
  }

  /**
   * Make authenticated API request
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID(),
          ...options.headers
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeout);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        toast.error(`Rate limited. Please wait ${delay / 1000} seconds.`);
        
        // Wait and retry once
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(method, endpoint, data, options);
      }

      // Parse response
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: result.message || `Request failed with status ${response.status}`,
          status: response.status
        };
      }

      return {
        data: result,
        status: response.status
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          error: 'Request timeout',
          status: 408
        };
      }
      
      return {
        error: error.message || 'Network error',
        status: 0
      };
    }
  }

  // Public API methods
  public get<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  public post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  public put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  public delete<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  // Specific API calls for Serenity
  public async getPatientMetrics() {
    return this.get<{
      totalPatients: number;
      activePatients: number;
      assessmentsToday: number;
      averagePHQ9: number;
      averageGAD7: number;
      averageAUDIT: number;
    }>('/metrics/patients');
  }

  public async getRevenueMetrics() {
    return this.get<{
      monthlyRevenue: number;
      yearlyRevenue: number;
      averagePerPatient: number;
      collectionRate: number;
      projectedAnnual: number;
    }>('/metrics/revenue');
  }

  public async submitAuditLog(event: any) {
    return this.post('/audit-logs', event);
  }

  public async getAuditLogs(filters?: any) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/audit-logs${params ? `?${params}` : ''}`);
  }

  public async triggerCrisisAlert(data: any) {
    return this.post('/crisis/alert', data);
  }

  public async submitAssessment(type: string, data: any) {
    return this.post(`/assessments/${type}`, data);
  }
}

// Create singleton instance
const apiService = new ApiService({
  baseUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.serenity-health.com'
});

export default apiService;
export { ApiService, type ApiResponse, type AuthTokens };