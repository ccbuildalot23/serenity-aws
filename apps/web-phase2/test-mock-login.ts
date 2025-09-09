// Test the mock login functionality
import cognitoAuth from './src/services/cognitoAuth.ts';

async function testMockLogin() {
  try {
    console.log('Testing mock login functionality...');
    
    // Test credentials
    const credentials = {
      email: 'test-patient@serenity.com',
      password: 'TestPass123!'
    };
    
    console.log('1. Testing login with patient credentials...');
    console.log('   Email:', credentials.email);
    console.log('   Password:', credentials.password);
    
    // This should work since we're in mock mode
    const authResponse = await cognitoAuth.login(credentials);
    
    console.log('✓ Login successful!');
    console.log('   User ID:', authResponse.user.id);
    console.log('   User Role:', authResponse.user.role);
    console.log('   User Email:', authResponse.user.email);
    console.log('   Tokens generated:', !!authResponse.tokens);
    
    // Test getting current user
    const currentUser = cognitoAuth.getCurrentUser();
    console.log('\n2. Testing getCurrentUser...');
    console.log('   Current user:', currentUser?.email);
    
    // Test authentication check
    console.log('\n3. Testing authentication status...');
    console.log('   Is authenticated:', cognitoAuth.isAuthenticated());
    console.log('   Session expired:', cognitoAuth.isSessionExpired());
    
    console.log('\n✓ Mock login system is working correctly!');
    
  } catch (error: any) {
    console.error('Mock login test failed:', error.message);
    console.error('Error details:', error);
  }
}

testMockLogin();