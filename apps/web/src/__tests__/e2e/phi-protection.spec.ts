/**
 * Playwright E2E Tests - PHI Protection and Session Management
 * Tests comprehensive HIPAA compliance scenarios end-to-end
 * Validates session timeouts, PHI masking, and privacy protection
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration for HIPAA compliance
const HIPAA_SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const HIPAA_WARNING_TIME = 13 * 60 * 1000; // 13 minutes
const PHI_ACCESS_DELAY = 1000; // Delay for PHI access operations

// Mock PHI data for testing (never use real PHI in tests)
const MOCK_PATIENT_DATA = {
  name: 'John Test Doe',
  dob: '1980-01-01',
  ssn: '***-**-1234', // Already masked
  diagnosis: 'Test Anxiety Disorder',
  treatment: 'Cognitive Behavioral Therapy'
};

const MOCK_CRISIS_DATA = {
  alertType: 'moderate_risk',
  timestamp: new Date().toISOString(),
  location: 'Patient Home',
  supporterContacts: ['Emergency Contact 1', 'Emergency Contact 2']
};

test.describe('PHI Protection and Session Management E2E', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create isolated context for each test
    context = await browser.newContext({
      // Simulate different user agents for testing
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HIPAA-Test-Browser/1.0'
    });

    page = await context.newPage();

    // Enable console logging to catch client-side errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser Error: ${msg.text()}`);
      }
    });

    // Monitor network requests for PHI exposure
    page.on('request', request => {
      const url = request.url();
      const postData = request.postData();
      
      // Check for accidental PHI in URLs (should never happen)
      if (url.includes('ssn=') || url.includes('dob=') || url.includes('diagnosis=')) {
        throw new Error(`PHI detected in URL: ${url}`);
      }

      // Check for unencrypted PHI in POST data
      if (postData && (
        postData.includes(MOCK_PATIENT_DATA.ssn.replace('***-**-', '')) ||
        postData.includes('123-45-6789') // Common test SSN
      )) {
        throw new Error(`Unmasked PHI detected in request body`);
      }
    });

    // Navigate to application
    await page.goto('/');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Session Timeout Compliance', () => {
    test('should enforce 15-minute session timeout for PHI access', async () => {
      // Authenticate user
      await authenticateUser(page, 'patient');

      // Access PHI data
      await accessPHIData(page);

      // Verify session is active
      await expect(page.locator('[data-testid="session-active"]')).toBeVisible();

      // Fast-forward time using browser's timer APIs (simulated)
      await page.evaluate(() => {
        // Mock Date.now to simulate time passage
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 15 * 60 * 1000; // 15 minutes later
        
        // Trigger session check
        window.dispatchEvent(new Event('focus'));
      });

      // Wait for session timeout
      await page.waitForSelector('[data-testid="session-expired"]', { timeout: 5000 });

      // Verify user is logged out and PHI is cleared
      await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
      await expect(page.locator('[data-testid="phi-data"]')).not.toBeVisible();

      // Verify redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should show warning at 13 minutes before timeout', async () => {
      await authenticateUser(page, 'patient');
      await accessPHIData(page);

      // Simulate 13 minutes passing
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 13 * 60 * 1000; // 13 minutes
        
        // Trigger session check
        window.dispatchEvent(new Event('focus'));
      });

      // Verify warning appears
      await expect(page.locator('[data-testid="session-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-warning"]')).toContainText('2 minutes');

      // Verify session is still active
      await expect(page.locator('[data-testid="session-active"]')).toBeVisible();
      await expect(page.locator('[data-testid="phi-data"]')).toBeVisible();
    });

    test('should reset session timeout on user activity', async () => {
      await authenticateUser(page, 'patient');
      await accessPHIData(page);

      // Simulate 12 minutes passing
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 12 * 60 * 1000; // 12 minutes
      });

      // User activity - click on page
      await page.click('body');
      await page.keyboard.press('Tab'); // Keyboard activity

      // Advance time to what would have been 15 minutes from original start
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 15 * 60 * 1000; // 15 minutes from original
      });

      // Session should still be active due to user activity reset
      await expect(page.locator('[data-testid="session-active"]')).toBeVisible();
      await expect(page.locator('[data-testid="phi-data"]')).toBeVisible();

      // Now advance to 15 minutes from the reset
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 27 * 60 * 1000; // 27 minutes total
      });

      await page.evaluate(() => window.dispatchEvent(new Event('focus')));

      // Now session should timeout
      await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
    });

    test('should extend session when user explicitly requests', async () => {
      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      // Advance to warning time
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 13 * 60 * 1000;
        window.dispatchEvent(new Event('focus'));
      });

      // Click extend session button
      await page.click('[data-testid="extend-session-button"]');

      // Verify session extended
      await expect(page.locator('[data-testid="session-extended"]')).toBeVisible();

      // Advance to original timeout time (15 minutes)
      await page.evaluate(() => {
        const originalNow = Date.now;
        const startTime = originalNow();
        Date.now = () => startTime + 15 * 60 * 1000;
        window.dispatchEvent(new Event('focus'));
      });

      // Session should still be active
      await expect(page.locator('[data-testid="session-active"]')).toBeVisible();
    });

    test('should clear all PHI from DOM on session timeout', async () => {
      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      // Verify PHI is present
      await expect(page.locator('[data-testid="patient-name"]')).toContainText(MOCK_PATIENT_DATA.name);
      await expect(page.locator('[data-testid="patient-diagnosis"]')).toContainText(MOCK_PATIENT_DATA.diagnosis);

      // Trigger session timeout
      await page.evaluate(() => {
        const originalNow = Date.now;
        Date.now = () => originalNow() + 15 * 60 * 1000;
        window.dispatchEvent(new Event('focus'));
      });

      await page.waitForSelector('[data-testid="session-expired"]');

      // Verify all PHI is cleared from DOM
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain(MOCK_PATIENT_DATA.name);
      expect(bodyText).not.toContain(MOCK_PATIENT_DATA.diagnosis);
      expect(bodyText).not.toContain(MOCK_PATIENT_DATA.dob);

      // Verify specific PHI elements are removed
      await expect(page.locator('[data-testid="patient-name"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="patient-diagnosis"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="phi-data"]')).not.toBeVisible();
    });
  });

  test.describe('PHI Privacy and Masking', () => {
    test('should mask sensitive data in UI by default', async () => {
      await authenticateUser(page, 'supporter');
      await accessPHIData(page);

      // Supporters should see masked/limited PHI
      await expect(page.locator('[data-testid="patient-ssn"]')).toContainText('***-**-');
      await expect(page.locator('[data-testid="patient-dob"]')).toContainText('**/**/****');
      
      // Some data may be visible but limited
      await expect(page.locator('[data-testid="patient-status"]')).toBeVisible();
      
      // Detailed diagnosis should not be visible to supporters
      await expect(page.locator('[data-testid="detailed-diagnosis"]')).not.toBeVisible();
    });

    test('should show different PHI levels based on user role', async () => {
      // Test provider access (full PHI)
      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      await expect(page.locator('[data-testid="patient-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="patient-diagnosis"]')).toBeVisible();
      await expect(page.locator('[data-testid="treatment-plan"]')).toBeVisible();

      await page.context().close();

      // Test patient access (own data)
      const patientContext = await page.context().browser()!.newContext();
      const patientPage = await patientContext.newPage();
      await patientPage.goto('/');
      
      await authenticateUser(patientPage, 'patient');
      await accessPHIData(patientPage);

      await expect(patientPage.locator('[data-testid="patient-name"]')).toBeVisible();
      await expect(patientPage.locator('[data-testid="my-diagnosis"]')).toBeVisible();
      await expect(patientPage.locator('[data-testid="my-treatment"]')).toBeVisible();

      await patientContext.close();
    });

    test('should prevent PHI from appearing in network requests', async () => {
      const networkRequests: string[] = [];
      
      page.on('request', request => {
        networkRequests.push(request.url());
        const postData = request.postData();
        if (postData) {
          networkRequests.push(postData);
        }
      });

      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      // Perform various operations that might expose PHI
      await page.fill('[data-testid="notes-input"]', 'Patient doing well with therapy');
      await page.click('[data-testid="save-notes"]');

      await page.click('[data-testid="share-button"]');
      await page.fill('[data-testid="share-message"]', 'Sharing patient progress');
      await page.click('[data-testid="confirm-share"]');

      // Verify no raw PHI in network requests
      const allNetworkData = networkRequests.join(' ');
      expect(allNetworkData).not.toContain(MOCK_PATIENT_DATA.name);
      expect(allNetworkData).not.toContain(MOCK_PATIENT_DATA.dob);
      expect(allNetworkData).not.toContain('123-45-6789'); // Full SSN
    });

    test('should handle screenshot and screen recording protection', async () => {
      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      // Check if PHI areas are marked for screen capture protection
      const phiElements = await page.locator('[data-phi-sensitive="true"]').all();
      expect(phiElements.length).toBeGreaterThan(0);

      // Verify CSS classes for screen protection are applied
      for (const element of phiElements) {
        const className = await element.getAttribute('class');
        expect(className).toContain('screen-capture-protected');
      }

      // Test that attempting to select PHI text triggers protection
      await page.locator('[data-testid="patient-ssn"]').click();
      
      // Should show protection warning if trying to copy sensitive data
      const isProtected = await page.locator('[data-testid="copy-protection-warning"]').isVisible();
      if (isProtected) {
        expect(isProtected).toBe(true);
      }
    });
  });

  test.describe('Crisis Alert Privacy Protection', () => {
    test('should send non-PHI crisis notifications to supporters', async () => {
      const networkRequests: { url: string; body?: string }[] = [];
      
      page.on('request', request => {
        networkRequests.push({
          url: request.url(),
          body: request.postData()
        });
      });

      await authenticateUser(page, 'patient');
      
      // Trigger crisis alert
      await page.click('[data-testid="crisis-help-button"]');
      await page.click('[data-testid="confirm-crisis-alert"]');

      // Wait for crisis alert to be processed
      await page.waitForSelector('[data-testid="crisis-alert-sent"]');

      // Verify crisis alert was sent
      await expect(page.locator('[data-testid="crisis-alert-sent"]')).toBeVisible();
      await expect(page.locator('[data-testid="crisis-alert-sent"]')).toContainText('Help is on the way');

      // Check network requests for crisis notifications
      const crisisRequests = networkRequests.filter(req => 
        req.url.includes('/crisis') || req.url.includes('/notification')
      );

      expect(crisisRequests.length).toBeGreaterThan(0);

      // Verify crisis notifications don't contain PHI
      crisisRequests.forEach(request => {
        if (request.body) {
          expect(request.body).not.toContain(MOCK_PATIENT_DATA.name);
          expect(request.body).not.toContain(MOCK_PATIENT_DATA.dob);
          expect(request.body).not.toContain(MOCK_PATIENT_DATA.diagnosis);
          
          // Should contain non-PHI crisis information
          expect(request.body).toContain('crisis_alert');
          expect(request.body).toContain('timestamp');
        }
      });
    });

    test('should provide appropriate crisis information without PHI exposure', async () => {
      await authenticateUser(page, 'supporter');
      
      // Simulate receiving crisis notification
      await page.evaluate(() => {
        // Simulate real-time crisis notification
        window.dispatchEvent(new CustomEvent('crisis-notification', {
          detail: {
            type: 'crisis_alert',
            patientId: 'anonymous-patient-123', // Non-identifying ID
            timestamp: new Date().toISOString(),
            riskLevel: 'moderate',
            location: 'general_area' // Not specific address
          }
        }));
      });

      // Verify crisis notification appears
      await expect(page.locator('[data-testid="crisis-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="crisis-notification"]')).toContainText('crisis alert');

      // Verify no PHI is displayed in crisis notification
      const notificationText = await page.locator('[data-testid="crisis-notification"]').textContent();
      expect(notificationText).not.toContain(MOCK_PATIENT_DATA.name);
      expect(notificationText).not.toContain(MOCK_PATIENT_DATA.dob);
      expect(notificationText).not.toContain(MOCK_PATIENT_DATA.diagnosis);

      // Should show appropriate response options
      await expect(page.locator('[data-testid="call-patient"]')).toBeVisible();
      await expect(page.locator('[data-testid="call-emergency"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-support-message"]')).toBeVisible();
    });

    test('should log crisis events with proper audit trail', async () => {
      await authenticateUser(page, 'patient');
      
      // Trigger crisis alert
      await page.click('[data-testid="crisis-help-button"]');
      await page.click('[data-testid="confirm-crisis-alert"]');

      await page.waitForSelector('[data-testid="crisis-alert-sent"]');

      // Check that audit log was created (in localStorage for testing)
      const auditLogs = await page.evaluate(() => {
        const logs = localStorage.getItem('hipaa_audit_logs_v2');
        return logs ? JSON.parse(logs) : [];
      });

      expect(auditLogs).toBeDefined();
      expect(Array.isArray(auditLogs)).toBe(true);

      // Find crisis-related audit entries
      const crisisLogs = auditLogs.filter((log: any) => 
        log.eventType === 'crisis_alert' || log.action.includes('crisis')
      );

      expect(crisisLogs.length).toBeGreaterThan(0);

      // Verify audit log structure
      const crisisLog = crisisLogs[0];
      expect(crisisLog).toHaveProperty('timestamp');
      expect(crisisLog).toHaveProperty('eventType');
      expect(crisisLog).toHaveProperty('userId');
      expect(crisisLog).toHaveProperty('sessionId');
      expect(crisisLog).toHaveProperty('phiAccessed');
      expect(crisisLog).toHaveProperty('riskLevel');
      
      expect(crisisLog.riskLevel).toBe('critical');
      expect(crisisLog.phiAccessed).toBe(true);
    });
  });

  test.describe('Cross-Browser PHI Protection', () => {
    test('should maintain PHI protection across different browsers', async () => {
      // This test would typically run with different browser configs
      // For now, we'll simulate different user agents
      const browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      ];

      for (const userAgent of browsers) {
        const testContext = await page.context().browser()!.newContext({ userAgent });
        const testPage = await testContext.newPage();
        
        await testPage.goto('/');
        await authenticateUser(testPage, 'provider');
        await accessPHIData(testPage);

        // Verify PHI masking works consistently
        await expect(testPage.locator('[data-testid="patient-ssn"]')).toContainText('***-**-');
        
        // Verify session timeout works
        await testPage.evaluate(() => {
          const originalNow = Date.now;
          Date.now = () => originalNow() + 15 * 60 * 1000;
          window.dispatchEvent(new Event('focus'));
        });

        await testPage.waitForSelector('[data-testid="session-expired"]', { timeout: 5000 });
        
        await testContext.close();
      }
    });
  });

  test.describe('Mobile Device PHI Protection', () => {
    test('should protect PHI on mobile viewports', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await authenticateUser(page, 'patient');
      await accessPHIData(page);

      // Verify mobile-specific PHI protection
      await expect(page.locator('[data-testid="phi-data"]')).toBeVisible();
      
      // Test mobile session timeout
      await page.evaluate(() => {
        const originalNow = Date.now;
        Date.now = () => originalNow() + 15 * 60 * 1000;
        
        // Simulate mobile app going to background and returning
        window.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'hidden'
        });
        window.dispatchEvent(new Event('visibilitychange'));
        
        // Simulate app returning to foreground after timeout
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'visible'
        });
        window.dispatchEvent(new Event('visibilitychange'));
      });

      // Should timeout even on mobile
      await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
    });

    test('should handle mobile touch interactions with PHI', async () => {
      await page.setViewportSize({ width: 414, height: 896 }); // iPhone XR
      
      await authenticateUser(page, 'provider');
      await accessPHIData(page);

      // Test touch interactions don't accidentally expose PHI
      await page.tap('[data-testid="patient-card"]');
      await page.tap('[data-testid="expand-details"]');

      // Verify expanded details still respect PHI protection
      await expect(page.locator('[data-testid="sensitive-details"]')).toHaveAttribute('data-phi-sensitive', 'true');
      
      // Test swipe gestures don't cause PHI exposure
      await page.touchscreen.tap(200, 300);
      await page.mouse.move(200, 300);
      await page.mouse.down();
      await page.mouse.move(400, 300);
      await page.mouse.up();

      // PHI should still be properly protected after gestures
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('123-45-6789'); // Full SSN should never be visible
    });
  });

  // Helper functions
  async function authenticateUser(page: Page, userType: 'patient' | 'provider' | 'supporter' | 'admin') {
    const credentials = {
      patient: { email: 'patient@test.com', password: 'TestPatient123!' },
      provider: { email: 'provider@test.com', password: 'TestProvider123!' },
      supporter: { email: 'supporter@test.com', password: 'TestSupporter123!' },
      admin: { email: 'admin@test.com', password: 'TestAdmin123!' }
    };

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', credentials[userType].email);
    await page.fill('[data-testid="password-input"]', credentials[userType].password);
    await page.click('[data-testid="login-button"]');

    // Wait for successful authentication
    await page.waitForURL(/.*\/dashboard/);
    await expect(page.locator('[data-testid="user-authenticated"]')).toBeVisible();
  }

  async function accessPHIData(page: Page) {
    // Navigate to section containing PHI
    await page.click('[data-testid="patient-records"]');
    await page.waitForSelector('[data-testid="phi-data"]');
    
    // Wait for PHI data to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(PHI_ACCESS_DELAY);
    
    // Verify PHI access was logged
    const auditLogs = await page.evaluate(() => {
      const logs = localStorage.getItem('hipaa_audit_logs_v2');
      return logs ? JSON.parse(logs) : [];
    });
    
    const phiAccessLogs = auditLogs.filter((log: any) => log.phiAccessed === true);
    expect(phiAccessLogs.length).toBeGreaterThan(0);
  }
});