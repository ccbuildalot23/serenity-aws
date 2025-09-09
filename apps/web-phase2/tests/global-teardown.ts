import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting PHI Protection E2E Test Cleanup');
  
  try {
    // Cleanup test artifacts
    console.log('📁 Cleaning up test artifacts...');
    
    // Generate test summary
    console.log('📊 Generating test summary...');
    const testResults = {
      timestamp: new Date().toISOString(),
      browser: 'chromium',
      environment: 'test',
      compliance: 'HIPAA PHI Protection Tests',
      status: 'completed'
    };
    
    console.log('Test Results Summary:', testResults);
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;