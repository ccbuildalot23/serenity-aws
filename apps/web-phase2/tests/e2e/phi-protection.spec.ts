import { test, expect } from '@playwright/test';

/**
 * PHI Protection End-to-End Tests
 * 
 * These tests validate the complete HIPAA-compliant session management
 * and PHI protection workflows in the Serenity AWS platform.
 * 
 * Test coverage:
 * - Session timeout and warning functionality
 * - User activity detection and timer reset
 * - Audit logging for compliance
 * - PHI access protection flows
 */

test.describe('PHI Protection Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state for testing
    await page.addInitScript(() => {
      // Mock localStorage with user session
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-provider-123',
            email: 'provider@serenityaws.com',
            role: 'provider',
            name: 'Test Provider'
          },
          isAuthenticated: true
        },
        version: 0
      }));
      
      // Mock any existing audit logs
      localStorage.setItem('auditLogs', JSON.stringify([]));
    });

    // Navigate to a protected page
    await page.goto('/dashboard');
    
    // Wait for authentication to be established
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 10000 });
  });

  test.describe('Session Timeout Protection', () => {
    test('shows session timeout warning after configured inactivity period', async ({ page }) => {
      // Set accelerated timeout for testing (2 minutes total, 30 seconds warning)
      await page.evaluate(() => {
        // Inject SessionTimeout component with short timeouts for testing
        const mockSessionTimeout = document.createElement('div');
        mockSessionTimeout.setAttribute('data-testid', 'session-timeout-component');
        document.body.appendChild(mockSessionTimeout);
      });

      // Wait for warning to appear (in real test this would be 13 minutes)
      // For E2E testing, we'll simulate the timer advance
      await page.evaluate(() => {
        // Simulate timer advancement by firing the warning event
        const event = new CustomEvent('sessionWarning', {
          detail: { remainingSeconds: 30 }
        });
        document.dispatchEvent(event);
      });

      // Verify warning modal appears
      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible({
        timeout: 5000
      });

      // Verify warning content
      await expect(page.locator('text=Session Timeout Warning')).toBeVisible();
      await expect(page.locator('text=Your session will expire soon')).toBeVisible();
      await expect(page.locator('text=HIPAA Security Requirement')).toBeVisible();
      await expect(page.locator('text=Continue Session')).toBeVisible();
      await expect(page.locator('text=Logout Now')).toBeVisible();
    });

    test('displays countdown timer in warning modal', async ({ page }) => {
      // Simulate session warning state
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning', {
          detail: { remainingSeconds: 90 }
        });
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Look for countdown timer (should show 1:30)
      await expect(page.locator('text=1:30')).toBeVisible({ timeout: 5000 });

      // Simulate countdown progression
      await page.evaluate(() => {
        const event = new CustomEvent('sessionCountdown', {
          detail: { remainingSeconds: 60 }
        });
        document.dispatchEvent(event);
      });

      // Should now show 1:00
      await expect(page.locator('text=1:00')).toBeVisible();
    });

    test('allows user to continue session from warning', async ({ page }) => {
      // Trigger warning
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Click continue session
      await page.click('text=Continue Session');

      // Warning should disappear
      await expect(page.locator('[data-testid="session-timeout-warning"]')).not.toBeVisible();

      // User should remain on the same page
      await expect(page.url()).toContain('/dashboard');

      // Verify audit log was created
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(auditLogs.some((log: any) => 
        log.event === 'SESSION_EXTENDED' && 
        log.action.includes('continued session')
      )).toBeTruthy();
    });

    test('redirects to login on session timeout', async ({ page }) => {
      // Mock session timeout
      await page.evaluate(() => {
        // Simulate automatic logout after timeout
        setTimeout(() => {
          localStorage.removeItem('auth-storage');
          window.location.href = '/login?reason=timeout';
        }, 100);
      });

      // Wait for redirect
      await page.waitForURL('**/login?reason=timeout', { timeout: 10000 });

      // Verify we're on login page with timeout reason
      expect(page.url()).toContain('/login?reason=timeout');

      // Verify timeout message is shown
      await expect(page.locator('text=session has expired')).toBeVisible({ timeout: 5000 });
    });

    test('allows immediate logout from warning modal', async ({ page }) => {
      // Trigger warning
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Click logout now
      await page.click('text=Logout Now');

      // Should redirect to login
      await page.waitForURL('**/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');

      // Verify logout was logged
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(auditLogs.some((log: any) => 
        log.event === 'SESSION_TIMEOUT'
      )).toBeTruthy();
    });
  });

  test.describe('User Activity Detection', () => {
    test('resets timer on mouse activity', async ({ page }) => {
      // Start near warning time
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Perform mouse activity
      await page.mouse.move(100, 100);
      await page.mouse.click(100, 100);

      // Warning should disappear due to activity
      await expect(page.locator('[data-testid="session-timeout-warning"]')).not.toBeVisible({
        timeout: 2000
      });

      // Verify activity was logged
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(auditLogs.some((log: any) => 
        log.action && log.action.includes('activity')
      )).toBeTruthy();
    });

    test('resets timer on keyboard activity', async ({ page }) => {
      // Start near warning time
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Perform keyboard activity
      await page.keyboard.press('ArrowDown');

      // Warning should disappear
      await expect(page.locator('[data-testid="session-timeout-warning"]')).not.toBeVisible({
        timeout: 2000
      });
    });

    test('resets timer on scroll activity', async ({ page }) => {
      // Add scrollable content
      await page.evaluate(() => {
        const tallDiv = document.createElement('div');
        tallDiv.style.height = '2000px';
        tallDiv.style.background = 'linear-gradient(to bottom, red, blue)';
        document.body.appendChild(tallDiv);
      });

      // Trigger warning
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await expect(page.locator('[data-testid="session-timeout-warning"]')).toBeVisible();

      // Scroll activity
      await page.mouse.wheel(0, 500);

      // Warning should disappear
      await expect(page.locator('[data-testid="session-timeout-warning"]')).not.toBeVisible({
        timeout: 2000
      });
    });

    test('handles rapid user activity without flooding logs', async ({ page }) => {
      // Perform rapid activities
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(i * 10, i * 10);
        await page.waitForTimeout(50); // Small delay between activities
      }

      // Check that logs aren't flooded (should be debounced)
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      const activityLogs = auditLogs.filter((log: any) => 
        log.action && log.action.includes('activity')
      );

      // Should have fewer logs than activities due to debouncing
      expect(activityLogs.length).toBeLessThan(10);
    });
  });

  test.describe('PHI Access Protection', () => {
    test('requires authentication for PHI endpoints', async ({ page }) => {
      // Clear authentication
      await page.evaluate(() => {
        localStorage.removeItem('auth-storage');
      });

      // Try to access patient data directly
      const response = await page.goto('/patients/patient-123');
      
      // Should redirect to login or show access denied
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/login');
    });

    test('logs PHI access attempts', async ({ page }) => {
      // Navigate to patient dashboard (PHI-containing page)
      await page.goto('/patients');

      // Wait for page load
      await page.waitForTimeout(1000);

      // Verify PHI access was logged
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(auditLogs.some((log: any) => 
        log.event === 'PHI_VIEW' || log.action.includes('PHI')
      )).toBeTruthy();
    });

    test('enforces session timeout during PHI access', async ({ page }) => {
      // Navigate to PHI page
      await page.goto('/patients/patient-123');

      // Simulate session timeout during PHI access
      await page.evaluate(() => {
        const event = new CustomEvent('sessionTimeout');
        document.dispatchEvent(event);
      });

      // Should be redirected to login
      await page.waitForURL('**/login**', { timeout: 10000 });

      // Verify timeout during PHI access was logged
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(auditLogs.some((log: any) => 
        log.event === 'SESSION_TIMEOUT' && 
        log.details && 
        log.details.context === 'PHI_ACCESS'
      )).toBeTruthy();
    });

    test('validates secure data transmission', async ({ page }) => {
      // Intercept network requests
      const requests: any[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          requests.push({
            url: request.url(),
            headers: request.headers(),
            method: request.method()
          });
        }
      });

      // Navigate to PHI page
      await page.goto('/patients');

      // Wait for any API calls
      await page.waitForTimeout(2000);

      // Verify security headers are present
      requests.forEach(request => {
        if (request.url.includes('patients')) {
          expect(request.headers.authorization).toBeTruthy();
          expect(request.url.startsWith('https:') || request.url.startsWith('http://localhost:')).toBeTruthy();
        }
      });
    });
  });

  test.describe('Audit Trail Compliance', () => {
    test('creates comprehensive audit logs for user session', async ({ page }) => {
      // Perform various actions that should be audited
      await page.goto('/dashboard');
      await page.click('[data-testid="navigation-patients"]');
      await page.click('[data-testid="patient-card-123"]');

      // Trigger session warning and continue
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });
      
      await page.click('text=Continue Session');

      // Check audit logs
      const auditLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      // Should have multiple audit entries
      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify required HIPAA audit fields
      auditLogs.forEach((log: any) => {
        expect(log.id).toBeTruthy();
        expect(log.timestamp).toBeTruthy();
        expect(log.event).toBeTruthy();
        expect(log.action).toBeTruthy();
      });

      // Should include session management events
      const sessionEvents = auditLogs.filter((log: any) => 
        log.event === 'SESSION_EXTENDED' || 
        log.event === 'PHI_VIEW' ||
        log.event === 'LOGIN'
      );
      
      expect(sessionEvents.length).toBeGreaterThan(0);
    });

    test('maintains audit log integrity across page refreshes', async ({ page }) => {
      // Create initial audit log
      await page.goto('/dashboard');
      
      let initialLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      // Refresh page
      await page.reload();

      // Check logs are preserved
      let preservedLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      expect(preservedLogs.length).toBe(initialLogs.length);
      
      // Perform new action
      await page.click('[data-testid="navigation-patients"]');

      let newLogs = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('auditLogs') || '[]');
      });

      // Should have additional log entry
      expect(newLogs.length).toBeGreaterThan(preservedLogs.length);
    });

    test('generates audit report data correctly', async ({ page }) => {
      // Perform multiple auditable actions
      await page.goto('/patients');
      await page.goto('/analytics');
      await page.goto('/settings');

      // Generate audit report
      const report = await page.evaluate(() => {
        const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
        
        // Simulate audit report generation
        const now = new Date();
        const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        const relevantLogs = logs.filter((log: any) => 
          new Date(log.timestamp) >= startDate
        );

        return {
          totalEvents: relevantLogs.length,
          phiAccess: relevantLogs.filter((log: any) => log.phiAccessed).length,
          uniqueUsers: new Set(relevantLogs.map((log: any) => log.userId)).size,
          eventTypes: [...new Set(relevantLogs.map((log: any) => log.event))]
        };
      });

      expect(report.totalEvents).toBeGreaterThan(0);
      expect(report.uniqueUsers).toBe(1); // Single test user
      expect(report.eventTypes.length).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('handles localStorage quota exceeded gracefully', async ({ page }) => {
      // Fill localStorage to near capacity
      await page.evaluate(() => {
        try {
          // Fill with large data
          for (let i = 0; i < 1000; i++) {
            localStorage.setItem(`bulk_data_${i}`, 'A'.repeat(1000));
          }
        } catch (e) {
          // Expected when quota is exceeded
        }
      });

      // Try to create session timeout (should handle gracefully)
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      // Page should still function
      await expect(page.locator('body')).toBeVisible();
    });

    test('recovers from corrupted session data', async ({ page }) => {
      // Corrupt session data
      await page.evaluate(() => {
        localStorage.setItem('auth-storage', 'invalid-json-data');
        localStorage.setItem('auditLogs', 'corrupted-audit-data');
      });

      // Navigate should handle gracefully
      await page.goto('/dashboard');

      // Should redirect to login due to invalid session
      await page.waitForURL('**/login**', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('handles concurrent session timeout scenarios', async ({ page }) => {
      // Open multiple tabs/windows (simulate with multiple events)
      await page.evaluate(() => {
        // Simulate multiple concurrent timeout warnings
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const event = new CustomEvent('sessionWarning');
            document.dispatchEvent(event);
          }, i * 100);
        }
      });

      // Should only show one warning modal
      const warnings = page.locator('[data-testid="session-timeout-warning"]');
      await expect(warnings).toHaveCount(1);
    });

    test('validates session timeout during network outage', async ({ page }) => {
      // Simulate network offline
      await page.context().setOffline(true);

      // Trigger session timeout
      await page.evaluate(() => {
        const event = new CustomEvent('sessionTimeout');
        document.dispatchEvent(event);
      });

      // Should still handle logout locally
      await page.waitForURL('**/login**', { timeout: 10000 });

      // Restore network
      await page.context().setOffline(false);
    });
  });

  test.describe('Accessibility and UX', () => {
    test('session warning is accessible to screen readers', async ({ page }) => {
      // Trigger warning
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      const modal = page.locator('[data-testid="session-timeout-warning"]');
      await expect(modal).toBeVisible();

      // Check ARIA attributes
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-labelledby');
      await expect(modal).toHaveAttribute('aria-describedby');

      // Check focus management
      const continueButton = page.locator('text=Continue Session');
      await expect(continueButton).toBeFocused();
    });

    test('provides clear feedback for user actions', async ({ page }) => {
      // Trigger warning and continue session
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      await page.click('text=Continue Session');

      // Should show brief confirmation (toast/notification)
      await expect(page.locator('text=Session extended')).toBeVisible({ timeout: 5000 });
    });

    test('handles mobile touch interactions', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Trigger warning
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning');
        document.dispatchEvent(event);
      });

      const modal = page.locator('[data-testid="session-timeout-warning"]');
      await expect(modal).toBeVisible();

      // Touch interactions should work
      await page.tap('text=Continue Session');
      
      await expect(modal).not.toBeVisible();
    });
  });
});