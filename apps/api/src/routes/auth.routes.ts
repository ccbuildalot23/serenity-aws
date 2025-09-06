import { Router, Request, Response } from 'express';
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  RespondToAuthChallengeCommand,
  GetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthService } from '../services/auth.service';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.REGION || 'us-east-1',
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['PATIENT', 'PROVIDER', 'SUPPORTER']),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const confirmSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
});

const mfaSchema = z.object({
  session: z.string(),
  code: z.string().length(6),
  email: z.string().email(),
});

// Helper function to calculate secret hash
function calculateSecretHash(username: string): string {
  const message = username + CLIENT_ID;
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest('base64');
}

// POST /auth/register - Create new user account
router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    // Sign up user in Cognito
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        { Name: 'email', Value: body.email },
        { Name: 'given_name', Value: body.firstName },
        { Name: 'family_name', Value: body.lastName },
        { Name: 'custom:role', Value: body.role },
        ...(body.phone ? [{ Name: 'phone_number', Value: body.phone }] : []),
      ],
    });

    const result = await cognitoClient.send(signUpCommand);

    res.json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
      userSub: result.UserSub,
      codeDeliveryDetails: result.CodeDeliveryDetails,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// POST /auth/verify-email - Confirm email with verification code
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const body = confirmSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash,
      Username: body.email,
      ConfirmationCode: body.code,
    });

    await cognitoClient.send(confirmCommand);

    // Add user to appropriate group based on their role
    // This would typically be done in a Cognito trigger, but for now we'll do it here
    // Note: This requires admin credentials which we'll set up later

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Verification failed',
    });
  }
});

// POST /auth/login - Authenticate user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
        SECRET_HASH: secretHash,
      },
    });

    const result = await cognitoClient.send(authCommand);

    // Handle MFA challenge if required
    if (result.ChallengeName === 'SMS_MFA' || result.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      return res.json({
        success: true,
        requiresMFA: true,
        challengeName: result.ChallengeName,
        session: result.Session,
      });
    }

    // Return tokens if authentication successful
    if (result.AuthenticationResult) {
      res.json({
        success: true,
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
        },
      });
    } else {
      throw new Error('Authentication failed');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

// POST /auth/mfa - Verify MFA code
router.post('/mfa', async (req: Request, res: Response) => {
  try {
    const body = mfaSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    const mfaCommand = new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'SMS_MFA',
      Session: body.session,
      ChallengeResponses: {
        SMS_MFA_CODE: body.code,
        USERNAME: body.email,
        SECRET_HASH: secretHash,
      },
    });

    const result = await cognitoClient.send(mfaCommand);

    if (result.AuthenticationResult) {
      res.json({
        success: true,
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
        },
      });
    } else {
      throw new Error('MFA verification failed');
    }
  } catch (error: any) {
    console.error('MFA error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'MFA verification failed',
    });
  }
});

// POST /auth/refresh - Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken, email } = req.body;
    
    if (!refreshToken || !email) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token and email required',
      });
    }

    const secretHash = calculateSecretHash(email);

    const refreshCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: secretHash,
      },
    });

    const result = await cognitoClient.send(refreshCommand);

    if (result.AuthenticationResult) {
      res.json({
        success: true,
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
        },
      });
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Token refresh failed',
    });
  }
});

// POST /auth/forgot-password - Initiate password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const body = forgotPasswordSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    const forgotCommand = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash,
      Username: body.email,
    });

    const result = await cognitoClient.send(forgotCommand);

    res.json({
      success: true,
      message: 'Password reset code sent to your email',
      codeDeliveryDetails: result.CodeDeliveryDetails,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to initiate password reset',
    });
  }
});

// POST /auth/reset-password - Complete password reset
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const secretHash = calculateSecretHash(body.email);

    const resetCommand = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash,
      Username: body.email,
      ConfirmationCode: body.code,
      Password: body.newPassword,
    });

    await cognitoClient.send(resetCommand);

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reset password',
    });
  }
});

// POST /auth/logout - Logout user (client-side token removal)
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      
      // Global sign out - invalidates all tokens
      const signOutCommand = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });
      
      try {
        await cognitoClient.send(signOutCommand);
      } catch (error) {
        // Token might already be invalid, which is fine
        console.log('Global sign out error (non-critical):', error);
      }
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Logout failed',
    });
  }
});

// GET /auth/user - Get current user profile
router.get('/user', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const accessToken = authHeader.substring(7);

    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken,
    });

    const user = await cognitoClient.send(getUserCommand);

    // Transform user attributes to a more friendly format
    const userProfile = user.UserAttributes?.reduce((acc: any, attr) => {
      const key = attr.Name?.replace('custom:', '').replace('_', '');
      if (key && attr.Value) {
        acc[key] = attr.Value;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      user: {
        username: user.Username,
        ...userProfile,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to get user profile',
    });
  }
});

export default router;