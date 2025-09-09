import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Runs once before all tests begin
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting PHI Protection E2E Test Suite');
  
  // Create a browser instance for global setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Verify that both servers are running
    console.log('🔍 Verifying API server is running...');
    await page.goto('http://localhost:3001/health', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('🔍 Verifying web server is running...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Clear any existing test data
    console.log('🧹 Clearing test data...');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;