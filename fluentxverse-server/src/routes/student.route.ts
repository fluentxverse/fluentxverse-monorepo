import Elysia, { t } from "elysia";
import StudentService from "../services/auth.services/student.service";
import { verifyAuthToken, signAuthToken, refreshJwtCookie, getCookieConfig, type JwtAuthPayload } from "../utils/jwt";
import { nanoid } from "nanoid";
import { verifyMessage } from "viem";
import { getUser } from "thirdweb/wallets";
import { thirdwebClient } from "../services/utils.services/utils";
import { ticketService } from "../services/ticket.services/ticket.service";
import { favoritesService } from "../services/favorites.services/favorites.service";
import { rateLimitMiddleware } from "../utils/rateLimiter";
import type { StudentUserData, NormalizedStudentUser } from "../services/auth.services/auth.interface";

// In-memory nonce store (use Redis in production for multi-instance deployments)
const nonceStore = new Map<string, { nonce: string; expires: number }>();

// Clean up expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (value.expires < now) {
      nonceStore.delete(key);
    }
  }
}, 60000); // Clean every minute

const Student = new Elysia({ name: "student" })
  .post("/student/register", async ({ body, cookie, set }) => {
    try {
      const studentService = new StudentService();
      const result = await studentService.register(body);
      const userData: StudentUserData = await studentService.login({ email: body.email, password: body.password });

      // Normalize user object for frontend consistency
      const normalizedUser: NormalizedStudentUser = {
        id: userData.id,
        userId: userData.id,
        email: userData.email,
        givenName: userData.givenName || null,
        familyName: userData.familyName || null,
        mobileNumber: userData.mobileNumber || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: (userData.smartWalletAddress && (typeof userData.smartWalletAddress === 'string')) ? userData.smartWalletAddress : ((userData.smartWalletAddress as { address: string } | null)?.address || null)
      };

      const token = await signAuthToken({
        userId: normalizedUser.userId,
        email: normalizedUser.email || '',
        familyName: normalizedUser.familyName || undefined,
        givenName: normalizedUser.givenName || undefined,
        mobileNumber: normalizedUser.mobileNumber || undefined,
        tier: normalizedUser.tier,
        role: normalizedUser.role,
        walletAddress: normalizedUser.walletAddress || undefined
      });
      const isProduction = process.env.NODE_ENV === 'production';
      cookie.studentAuth?.set({
        value: token,
        ...getCookieConfig(isProduction)
      });

      return {
        success: true,
        message: result.message,
        user: normalizedUser
      };
    } catch (error: any) {
      console.log(error);
      // Map email-exists to a 409 friendly response
      if (error?.code === 'EMAIL_EXISTS' || error?.message === 'EMAIL_EXISTS') {
        if (set) set.status = 409;
        return { success: false, message: 'Email is already registered', user: null };
      }
      throw error;
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      familyName: t.String(),
      givenName: t.String(),
      birthDate: t.String(),
      mobileNumber: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        user: t.Any()
      })
    }
  })

  .post("/student/login", async ({ body, cookie, request, set }) => {
    // Rate limit login attempts to prevent brute force attacks
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await rateLimitMiddleware(clientIp, 'auth', set as any);
    if (rateLimitResult) return rateLimitResult;
    
    try {
      const studentService = new StudentService();
      const userData: StudentUserData = await studentService.login(body);

      const normalizedUser: NormalizedStudentUser = {
        id: userData.id,
        userId: userData.id,
        email: userData.email,
        givenName: userData.givenName || null,
        familyName: userData.familyName || null,
        mobileNumber: userData.mobileNumber || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: (userData.smartWalletAddress && (typeof userData.smartWalletAddress === 'string')) ? userData.smartWalletAddress : ((userData.smartWalletAddress as { address: string } | null)?.address || null)
      };

      const token = await signAuthToken({
        userId: normalizedUser.userId,
        email: normalizedUser.email || '',
        familyName: normalizedUser.familyName || undefined,
        givenName: normalizedUser.givenName || undefined,
        mobileNumber: normalizedUser.mobileNumber || undefined,
        tier: normalizedUser.tier,
        role: normalizedUser.role,
        walletAddress: normalizedUser.walletAddress || undefined
      });
      const isProduction = process.env.NODE_ENV === 'production';
      cookie.studentAuth?.set({
        value: token,
        ...getCookieConfig(isProduction)
      });

      return {
        success: true,
        user: normalizedUser
      };
    } catch (error: any) {
      console.log('[/student/login] Error:', error?.message || error);
      
      // Handle specific error messages with friendly responses
      const errorMessage = error?.message || 'Login failed';
      
      if (errorMessage.includes('Invalid email or password')) {
        return {
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.',
          user: null
        };
      }
      
      if (errorMessage.includes('suspended')) {
        return {
          success: false,
          error: errorMessage, // Keep suspension details
          user: null
        };
      }
      
      // For other errors, throw to let global handler process
      throw error;
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        user: t.Any(),
        error: t.Optional(t.String())
      })
    }
  })

  .post('/student/logout', async ({ cookie, set }) => {
    // Aggressively clear the student cookie with all possible methods
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieConfig = getCookieConfig(isProduction);
    
    // Method 1: Set empty value with expired date
    cookie.studentAuth?.set({
      value: '',
      ...cookieConfig,
      maxAge: 0,
      expires: new Date(0)
    });
    
    // Method 2: Use remove()
    cookie.studentAuth?.remove();
    
    // Method 3: Explicit Set-Cookie header to clear the *domain cookie*.
    // Important: some runtimes/frameworks will only emit ONE Set-Cookie header
    // when multiple cookie operations occur; ensure the last one targets the
    // cross-subdomain cookie your frontends actually use.
    const domainAttr = cookieConfig.domain ? `; Domain=${cookieConfig.domain}` : '';
    set.headers['Set-Cookie'] = `studentAuth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${domainAttr}; HttpOnly; SameSite=${isProduction ? 'None; Secure' : 'Lax'}`;
    
    // Set headers to prevent caching
    set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    set.headers['Pragma'] = 'no-cache';
    
    console.log('🚪 Student logout - cookie cleared');
    
    return { success: true, message: 'Logged out successfully' };
  }, {
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      })
    }
  })

  // Renew student session cookie (extends maxAge) without re-authenticating
  .post('/student/refresh', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const payload = await verifyAuthToken(raw as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }

      await refreshJwtCookie(cookie, payload, 'studentAuth');

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';
      return { success: true };
    } catch (error: any) {
      console.error('Error refreshing student session:', error);
      throw new Error('Invalid session');
    }
  }, {
    response: {
      200: t.Object({
        success: t.Boolean()
      })
    }
  })

  .get('/student/me', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const payload = await verifyAuthToken(raw as string);
      if (!payload) {
        set.status = 401;
        return { user: null, error: 'Invalid or expired token' };
      }

      // Refresh cookie on every /me call
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';

      const normalized = {
        userId: payload.userId || null,
        id: payload.userId || null,
        email: payload.email,
        givenName: payload.givenName ?? payload.firstName ?? undefined,
        familyName: payload.familyName ?? payload.lastName ?? undefined,
        firstName: payload.firstName ?? payload.givenName ?? undefined,
        lastName: payload.lastName ?? payload.familyName ?? undefined,
        walletAddress: payload.walletAddress ?? undefined,
        mobileNumber: payload.mobileNumber ?? undefined,
        tier: payload.tier ?? 0,
        role: payload.role ?? 'student'
      };

      return { user: normalized };
    } catch (error: any) {
      console.error('Error parsing student auth cookie:', error);
      throw new Error('Invalid session');
    }
  }, {
    response: {
      200: t.Object({ user: t.Any() })
    }
  })

  .put('/student/user/personal-info', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const payload = await verifyAuthToken(raw as string);
      if (!payload) {
        set.status = 401;
        return { success: false, message: 'Invalid or expired token' };
      }

      const studentService = new StudentService();
      const result = await studentService.updatePersonalInfo({
        userId: payload.userId,
        ...body
      });

      // Update mobileNumber in cookie if phoneNumber was updated
      if (body.phoneNumber) {
        const token = await signAuthToken({
          ...payload,
          mobileNumber: body.phoneNumber
        });
        const isProduction = process.env.NODE_ENV === 'production';
        cookie.studentAuth?.set({
          value: token,
          ...getCookieConfig(isProduction)
        });
      }

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';

      return { success: true, message: result.message };
    } catch (error: any) {
      console.error('Error updating student personal info:', error);
      throw error;
    }
  }, {
    body: t.Object({
      phoneNumber: t.Optional(t.String()),
      country: t.Optional(t.String()),
      region: t.Optional(t.String()),
      regionName: t.Optional(t.String()),
      province: t.Optional(t.String()),
      provinceName: t.Optional(t.String()),
      city: t.Optional(t.String()),
      cityName: t.Optional(t.String()),
      zipCode: t.Optional(t.String()),
      addressLine: t.Optional(t.String()),
      sameAsPermanent: t.Optional(t.Boolean()),
      schoolAttended: t.Optional(t.String()),
      educationalAttainment: t.Optional(t.String()),
      major: t.Optional(t.String()),
      teachingExperience: t.Optional(t.String()),
      teachingQualifications: t.Optional(t.Array(t.String())),
      currentProficiency: t.Optional(t.String()),
      learningGoals: t.Optional(t.Array(t.String())),
      preferredLearningStyle: t.Optional(t.String()),
      availability: t.Optional(t.Array(t.String())),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      })
    }
  })

  .put('/student/user/email', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const payload = await verifyAuthToken(raw as string);
      if (!payload) {
        set.status = 401;
        return { success: false, message: 'Invalid or expired token' };
      }

      const studentService = new StudentService();
      const result = await studentService.updateEmail({
        userId: payload.userId,
        newEmail: body.newEmail,
        currentPassword: body.currentPassword
      });

      // Update email in cookie
      const token = await signAuthToken({
        ...payload,
        email: body.newEmail.toLowerCase()
      });
      const isProduction = process.env.NODE_ENV === 'production';
      cookie.studentAuth?.set({
        value: token,
        ...getCookieConfig(isProduction)
      });

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';

      return { success: true, message: result.message };
    } catch (error: any) {
      console.error('Error updating student email:', error);
      throw error;
    }
  }, {
    body: t.Object({
      newEmail: t.String(),
      currentPassword: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      })
    }
  })

  .put('/student/user/password', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const payload = await verifyAuthToken(raw as string);
      if (!payload) {
        set.status = 401;
        return { success: false, message: 'Invalid or expired token' };
      }

      const studentService = new StudentService();
      const result = await studentService.updatePassword({
        userId: payload.userId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword
      });

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';

      return { success: true, message: result.message };
    } catch (error: any) {
      console.error('Error updating student password:', error);
      throw error;
    }
  }, {
    body: t.Object({
      currentPassword: t.String(),
      newPassword: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      })
    }
  })

  // Generate a nonce for wallet authentication (SIWE - Sign-In With Wallet)
  .post('/student/auth/wallet/nonce', async ({ body, set }) => {
    try {
      const { walletAddress } = body;
      
      // Generate a unique nonce
      const nonce = nanoid(32);
      const expires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
      
      // Store nonce associated with wallet address
      nonceStore.set(walletAddress.toLowerCase(), { nonce, expires });
      
      // Create the message to be signed
      const message = `Sign this message to authenticate with FluentXVerse.\n\nNonce: ${nonce}\nWallet: ${walletAddress}\nTimestamp: ${new Date().toISOString()}`;
      
      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      
      return {
        success: true,
        nonce,
        message
      };
    } catch (error: any) {
      console.error('Nonce generation error:', error);
      throw error;
    }
  }, {
    body: t.Object({
      walletAddress: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        nonce: t.String(),
        message: t.String()
      })
    }
  })

  // Wallet-based authentication with signature verification (SIWE)
  .post('/student/auth/wallet', async ({ body, cookie, set }) => {
    try {
      const { walletAddress, signature, message } = body;
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Step 1: Verify nonce exists and hasn't expired
      const storedNonce = nonceStore.get(normalizedAddress);
      if (!storedNonce) {
        set.status = 401;
        return {
          success: false,
          status: 'error',
          user: null,
          message: 'Invalid or expired nonce. Please request a new one.'
        };
      }
      
      if (storedNonce.expires < Date.now()) {
        nonceStore.delete(normalizedAddress);
        set.status = 401;
        return {
          success: false,
          status: 'error',
          user: null,
          message: 'Nonce expired. Please request a new one.'
        };
      }
      
      // Verify the nonce is in the message
      if (!message.includes(storedNonce.nonce)) {
        set.status = 401;
        return {
          success: false,
          status: 'error',
          user: null,
          message: 'Invalid message format.'
        };
      }
      
      // Step 2: Verify signature
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`
      });
      
      if (!isValid) {
        set.status = 401;
        return {
          success: false,
          status: 'error',
          user: null,
          message: 'Invalid signature. Authentication failed.'
        };
      }
      
      // Step 3: Check if wallet exists in database
      const studentService = new StudentService();
      const result = await studentService.loginByWallet(walletAddress);

      if (result.status === 'not_found') {
        // Keep nonce for registration - don't delete it yet
        return {
          success: true,
          status: 'not_found',
          user: null,
          message: 'Wallet not found. Please complete registration.'
        };
      }

      if (result.status === 'incomplete_registration') {
        // Keep nonce for registration completion - don't delete it yet
        return {
          success: true,
          status: 'incomplete_registration',
          user: result.user,
          missingFields: result.missingFields,
          message: 'Registration incomplete. Please complete your profile.'
        };
      }

      // Full authentication - delete nonce and set cookie
      nonceStore.delete(normalizedAddress);
      
      const userData: StudentUserData = result.user;
      const normalizedUser: NormalizedStudentUser = {
        id: userData.id,
        userId: userData.id,
        email: userData.email,
        givenName: userData.givenName || null,
        familyName: userData.familyName || null,
        mobileNumber: userData.mobileNumber || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: userData.externalWalletAddress || (typeof userData.smartWalletAddress === 'string' ? userData.smartWalletAddress : null) || null
      };

      const token = await signAuthToken({
        userId: normalizedUser.userId,
        email: normalizedUser.email || '',
        familyName: normalizedUser.familyName || undefined,
        givenName: normalizedUser.givenName || undefined,
        mobileNumber: normalizedUser.mobileNumber || undefined,
        tier: normalizedUser.tier,
        role: normalizedUser.role,
        walletAddress: normalizedUser.walletAddress || undefined
      });
      const isProduction = process.env.NODE_ENV === 'production';
      cookie.studentAuth?.set({
        value: token,
        ...getCookieConfig(isProduction)
      });

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';

      return {
        success: true,
        status: 'authenticated',
        user: normalizedUser,
        message: 'Login successful'
      };
    } catch (error: any) {
      console.error('Wallet auth error:', error);
      throw error;
    }
  }, {
    body: t.Object({
      walletAddress: t.String(),
      signature: t.String(),
      message: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        status: t.String(),
        user: t.Any(),
        message: t.String(),
        missingFields: t.Optional(t.Array(t.String()))
      })
    }
  })

  // Register new student with wallet (from Thirdweb social login) - requires signature verification
  .post('/student/register/wallet', async ({ body, cookie, set }) => {
    try {
      const { walletAddress, signature, message, email, givenName, familyName, birthDate, mobileNumber } = body;
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Verify nonce exists and hasn't expired
      const storedNonce = nonceStore.get(normalizedAddress);
      if (!storedNonce) {
        set.status = 401;
        return { success: false, message: 'Invalid or expired nonce. Please request a new one.', user: null };
      }
      
      if (storedNonce.expires < Date.now()) {
        nonceStore.delete(normalizedAddress);
        set.status = 401;
        return { success: false, message: 'Nonce expired. Please request a new one.', user: null };
      }
      
      // Verify the nonce is in the message
      if (!message.includes(storedNonce.nonce)) {
        set.status = 401;
        return { success: false, message: 'Invalid message format.', user: null };
      }
      
      // Verify signature
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`
      });
      
      if (!isValid) {
        set.status = 401;
        return { success: false, message: 'Invalid signature. Authentication failed.', user: null };
      }
      
      // Verify email matches OAuth provider if email is provided
      if (email) {
        try {
          const thirdwebUser = await getUser({
            client: thirdwebClient,
            walletAddress: walletAddress
          });
          
          if (thirdwebUser && thirdwebUser.email) {
            // Email must match what OAuth provider gave us
            if (thirdwebUser.email.toLowerCase() !== email.toLowerCase()) {
              set.status = 400;
              return { 
                success: false, 
                message: 'Email does not match the authenticated account. Please use the email from your OAuth provider.', 
                user: null 
              };
            }
          }
        } catch (verifyError) {
          console.error('Failed to verify email with Thirdweb:', verifyError);
          // Continue without email verification if Thirdweb check fails
          // This allows fallback for edge cases
        }
      }
      
      // Delete used nonce (one-time use)
      nonceStore.delete(normalizedAddress);
      
      const studentService = new StudentService();
      const result = await studentService.registerByWallet({ walletAddress, email, givenName, familyName, birthDate, mobileNumber });

      // Send a free trial ticket to the newly registered user
      try {
        const trialResult = await ticketService.transferTrialTicketToNewUser(walletAddress);
        if (trialResult.success) {
          console.log(`✅ Trial ticket sent to new user: ${walletAddress}`);
        } else {
          console.log(`⚠️ Could not send trial ticket: ${trialResult.error}`);
        }
      } catch (trialError) {
        // Don't fail registration if trial ticket transfer fails
        console.error('Failed to send trial ticket to new user:', trialError);
      }

      const userData: StudentUserData = result.user;
      const normalizedUser: NormalizedStudentUser = {
        id: userData.id,
        userId: userData.id,
        email: userData.email,
        givenName: userData.givenName || null,
        familyName: userData.familyName || null,
        mobileNumber: userData.mobileNumber || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: userData.externalWalletAddress || null
      };

      const token = await signAuthToken({
        userId: normalizedUser.userId,
        email: normalizedUser.email || '',
        familyName: normalizedUser.familyName || undefined,
        givenName: normalizedUser.givenName || undefined,
        mobileNumber: normalizedUser.mobileNumber || undefined,
        tier: normalizedUser.tier,
        role: normalizedUser.role,
        walletAddress: normalizedUser.walletAddress || undefined
      });
      const isProduction = process.env.NODE_ENV === 'production';
      cookie.studentAuth?.set({
        value: token,
        ...getCookieConfig(isProduction)
      });

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';

      return {
        success: true,
        message: result.message,
        user: normalizedUser
      };
    } catch (error: any) {
      console.error('Wallet registration error:', error);
      if (error?.code === 'WALLET_EXISTS') {
        if (set) set.status = 409;
        return { success: false, message: 'Wallet is already registered', user: null };
      }
      if (error?.code === 'EMAIL_EXISTS') {
        if (set) set.status = 409;
        return { success: false, message: 'Email is already registered', user: null };
      }
      throw error;
    }
  }, {
    body: t.Object({
      walletAddress: t.String(),
      signature: t.String(),
      message: t.String(),
      email: t.Optional(t.String()),
      givenName: t.Optional(t.String()),
      familyName: t.Optional(t.String()),
      birthDate: t.Optional(t.String()),
      mobileNumber: t.Optional(t.String())
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        user: t.Any()
      })
    }
  })

  /**
   * Get student's own profile
   * GET /student/profile
   */
  .get('/student/profile', async ({ cookie, set }) => {
    console.log('[StudentRoute] GET /student/profile - Request received');
    
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        console.error('[StudentRoute] No studentAuth cookie');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        console.error('[StudentRoute] Invalid or expired token');
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      console.log('[StudentRoute] Fetching profile for student:', studentId);
      const studentService = new StudentService();
      const profileData = await studentService.getOwnProfile(studentId);

      return { success: true, data: profileData };
    } catch (error: any) {
      console.error('[StudentRoute] Profile error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to get profile' };
    }
  })

  /**
   * Update student's lesson preferences
   * PUT /student/preferences
   */
  .put('/student/preferences', async ({ body, cookie, set }) => {
    console.log('[StudentRoute] PUT /student/preferences - Request received');
    
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        console.error('[StudentRoute] No studentAuth cookie');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        console.error('[StudentRoute] Invalid or expired token');
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      const preferences = body as {
        preferCameraOn: boolean;
        errorCorrection: 'during_feedback' | 'proactively' | 'tutor_choice';
        otherRequests: string;
      };

      console.log('[StudentRoute] Updating preferences for student:', studentId, preferences);
      const studentService = new StudentService();
      const result = await studentService.updateLessonPreferences(studentId, preferences);

      return result;
    } catch (error: any) {
      console.error('[StudentRoute] Preferences update error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to update preferences' };
    }
  })

  /**
   * Update student's About Me info (purpose, occupation, hobbies)
   * PUT /student/about-me
   */
  .put('/student/about-me', async ({ body, cookie, set }) => {
    console.log('[StudentRoute] PUT /student/about-me - Request received');
    
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        console.error('[StudentRoute] No studentAuth cookie');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        console.error('[StudentRoute] Invalid or expired token');
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      const aboutMe = body as {
        purpose: string;
        occupation: string;
        hobbies: string[];
        bio: string;
      };

      console.log('[StudentRoute] Updating about me for student:', studentId, aboutMe);
      const studentService = new StudentService();
      const result = await studentService.updateAboutMe(studentId, aboutMe);

      return result;
    } catch (error: any) {
      console.error('[StudentRoute] About Me update error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to update about me' };
    }
  })

  /**
   * Save last viewed lesson for student
   * PUT /student/last-viewed-lesson
   */
  .put('/student/last-viewed-lesson', async ({ body, cookie, set }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      const lesson = body as {
        courseId: string;
        lessonId: string;
        lessonNumber: number;
        title: string;
        goal: string;
        viewedAt: number;
      };

      const studentService = new StudentService();
      const result = await studentService.saveLastViewedLesson(studentId, lesson);

      return result;
    } catch (error: any) {
      console.error('[StudentRoute] Save last viewed lesson error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to save last viewed lesson' };
    }
  })

  /**
   * Get last viewed lesson for student
   * GET /student/last-viewed-lesson
   */
  .get('/student/last-viewed-lesson', async ({ cookie, set }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      const studentService = new StudentService();
      const result = await studentService.getLastViewedLesson(studentId);

      return result;
    } catch (error: any) {
      console.error('[StudentRoute] Get last viewed lesson error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to get last viewed lesson' };
    }
  })

  /**
   * Get student's favorite tutors with pagination
   * GET /student/favorites?page=1&limit=10
   */
  .get('/student/favorites', async ({ cookie, set, query }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, error: 'Not authenticated', data: { favorites: [], total: 0, page: 1, limit: 10, totalPages: 0 } };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token', data: { favorites: [], total: 0, page: 1, limit: 10, totalPages: 0 } };
      }
      const studentId = payload.userId;

      // Parse pagination params with defaults
      const page = Math.max(1, parseInt(query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));

      const result = await favoritesService.getFavorites(studentId, page, limit);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[StudentRoute] Get favorites error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to get favorites', data: { favorites: [], total: 0, page: 1, limit: 10, totalPages: 0 } };
    }
  })

  /**
   * Add a tutor to favorites
   * POST /student/favorites/:tutorId
   * Rate limited: 30 actions per minute
   */
  .post('/student/favorites/:tutorId', async ({ params, cookie, set }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Rate limiting check
      const rateLimitError = await rateLimitMiddleware(studentId, 'favorites', set as any);
      if (rateLimitError) return rateLimitError;

      const { tutorId } = params;
      const result = await favoritesService.addFavorite(studentId, tutorId);
      return result;
    } catch (error: any) {
      console.error('[StudentRoute] Add favorite error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to add favorite' };
    }
  })

  /**
   * Remove a tutor from favorites
   * DELETE /student/favorites/:tutorId
   */
  .delete('/student/favorites/:tutorId', async ({ params, cookie, set }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      const { tutorId } = params;
      const result = await favoritesService.removeFavorite(studentId, tutorId);
      return result;
    } catch (error: any) {
      console.error('[StudentRoute] Remove favorite error:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to remove favorite' };
    }
  })

  /**
   * Check if a tutor is in favorites
   * GET /student/favorites/:tutorId/check
   */
  .get('/student/favorites/:tutorId/check', async ({ params, cookie, set }) => {
    try {
      const authCookie = cookie.studentAuth?.value;
      if (!authCookie) {
        set.status = 401;
        return { success: false, isFavorite: false };
      }

      const payload = await verifyAuthToken(authCookie as string);
      if (!payload) {
        set.status = 401;
        return { success: false, isFavorite: false };
      }
      const studentId = payload.userId;

      const { tutorId } = params;
      const isFavorite = await favoritesService.isFavorite(studentId, tutorId);
      return { success: true, isFavorite };
    } catch (error: any) {
      console.error('[StudentRoute] Check favorite error:', error);
      set.status = 500;
      return { success: false, isFavorite: false };
    }
  });

export default Student;
