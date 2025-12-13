import Elysia, { t } from "elysia";
import StudentService from "../services/auth.services/student.service";
import { refreshAuthCookie } from "../utils/refreshCookie";
import { nanoid } from "nanoid";
import { verifyMessage } from "viem";

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
      const userData = await studentService.login({ email: body.email, password: body.password });

      // Normalize user object for frontend consistency
      const normalizedUser = {
        id: userData.id || userData.userId || userData.uid,
        userId: userData.id || userData.userId || userData.uid,
        email: userData.email,
        givenName: userData.givenName || userData.firstName || userData.given_name || null,
        familyName: userData.familyName || userData.lastName || userData.family_name || null,
        mobileNumber: userData.mobileNumber || userData.phone || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: (userData.smartWalletAddress && (typeof userData.smartWalletAddress === 'string')) ? userData.smartWalletAddress : (userData.smartWalletAddress?.address || null)
      };

      cookie.studentAuth?.set({
        value: JSON.stringify({
          userId: normalizedUser.userId,
          email: normalizedUser.email,
          familyName: normalizedUser.familyName,
          givenName: normalizedUser.givenName,
          mobileNumber: normalizedUser.mobileNumber,
          tier: normalizedUser.tier,
          role: normalizedUser.role,
          walletAddress: normalizedUser.walletAddress
        }),

        httpOnly: true,
        secure: true, // Always true for sameSite:none
        sameSite: "none", // Required for cross-origin
        maxAge: 60 * 60,
        path: "/"
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

  .post("/student/login", async ({ body, cookie }) => {
    try {
      const studentService = new StudentService();
      const userData = await studentService.login(body);

      const normalizedUser = {
        id: userData.id || userData.userId || userData.uid,
        userId: userData.id || userData.userId || userData.uid,
        email: userData.email,
        givenName: userData.givenName || userData.firstName || userData.given_name || null,
        familyName: userData.familyName || userData.lastName || userData.family_name || null,
        mobileNumber: userData.mobileNumber || userData.phone || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: (userData.smartWalletAddress && (typeof userData.smartWalletAddress === 'string')) ? userData.smartWalletAddress : (userData.smartWalletAddress?.address || null)
      };

      cookie.studentAuth?.set({
        value: JSON.stringify({
          userId: normalizedUser.userId,
          email: normalizedUser.email,
          familyName: normalizedUser.familyName,
          givenName: normalizedUser.givenName,
          mobileNumber: normalizedUser.mobileNumber,
          tier: normalizedUser.tier,
          role: normalizedUser.role,
          walletAddress: normalizedUser.walletAddress
        }),
        httpOnly: true,
        secure: false, // False for localhost HTTP
        sameSite: "lax", // Lax works for localhost
        maxAge: 60 * 60,
        path: "/"
      });

      return {
        success: true,
        user: normalizedUser
      };
    } catch (error: any) {
      console.log(error);
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
        user: t.Any()
      })
    }
  })

  .post('/student/logout', async ({ cookie, set }) => {
    // Aggressively clear the student cookie with all possible methods
    cookie.studentAuth?.set({
      value: '',
      httpOnly: true,
      secure: false, // Match login settings
      sameSite: 'lax', // Match login settings
      maxAge: 0, // Expire immediately
      expires: new Date(0), // Also set explicit past date
      path: '/'
    });
    cookie.studentAuth?.remove();
    
    // Set headers to prevent caching
    set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    set.headers['Pragma'] = 'no-cache';
    
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
      const authData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      refreshAuthCookie(cookie, authData, 'studentAuth');

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
      const authData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      // Refresh cookie on every /me call
      refreshAuthCookie(cookie, authData, 'studentAuth');

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';

      const normalized = {
        userId: authData.userId || authData.id || null,
        id: authData.userId || authData.id || null,
        email: authData.email,
        givenName: authData.givenName ?? authData.firstName ?? undefined,
        familyName: authData.familyName ?? authData.lastName ?? undefined,
        firstName: authData.firstName ?? authData.givenName ?? undefined,
        lastName: authData.lastName ?? authData.familyName ?? undefined,
        walletAddress: authData.walletAddress ?? authData.smartWalletAddress ?? undefined,
        mobileNumber: authData.mobileNumber ?? undefined,
        tier: authData.tier ?? 0,
        role: authData.role ?? 'student'
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
      const authData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      const studentService = new StudentService();
      const result = await studentService.updatePersonalInfo({
        userId: authData.userId,
        ...body
      });

      // Update mobileNumber in cookie if phoneNumber was updated
      if (body.phoneNumber) {
        cookie.studentAuth?.set({
          value: JSON.stringify({
            ...authData,
            mobileNumber: body.phoneNumber
          }),
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 60,
          path: '/'
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
      const authData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      const studentService = new StudentService();
      const result = await studentService.updateEmail({
        userId: authData.userId,
        newEmail: body.newEmail,
        currentPassword: body.currentPassword
      });

      // Update email in cookie
      cookie.studentAuth?.set({
        value: JSON.stringify({
          ...authData,
          email: body.newEmail.toLowerCase()
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 60,
        path: '/'
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
      const authData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      const studentService = new StudentService();
      const result = await studentService.updatePassword({
        userId: authData.userId,
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
      
      const userData = result.user;
      const normalizedUser = {
        id: userData.id || userData.userId || userData.uid,
        userId: userData.id || userData.userId || userData.uid,
        email: userData.email,
        givenName: userData.givenName || userData.firstName || userData.given_name || null,
        familyName: userData.familyName || userData.lastName || userData.family_name || null,
        mobileNumber: userData.mobileNumber || userData.phone || null,
        tier: userData.tier ?? 0,
        role: userData.role || 'student',
        walletAddress: userData.externalWalletAddress || userData.smartWalletAddress || null
      };

      cookie.studentAuth?.set({
        value: JSON.stringify({
          userId: normalizedUser.userId,
          email: normalizedUser.email,
          familyName: normalizedUser.familyName,
          givenName: normalizedUser.givenName,
          mobileNumber: normalizedUser.mobileNumber,
          tier: normalizedUser.tier,
          role: normalizedUser.role,
          walletAddress: normalizedUser.walletAddress
        }),
        httpOnly: true,
        secure: false, // False for localhost HTTP
        sameSite: "lax", // Lax works for localhost
        maxAge: 60 * 60,
        path: "/"
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
      
      // Delete used nonce (one-time use)
      nonceStore.delete(normalizedAddress);
      
      const studentService = new StudentService();
      const result = await studentService.registerByWallet({ walletAddress, email, givenName, familyName, birthDate, mobileNumber });

      const userData = result.user;
      const normalizedUser = {
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

      cookie.studentAuth?.set({
        value: JSON.stringify({
          userId: normalizedUser.userId,
          email: normalizedUser.email,
          familyName: normalizedUser.familyName,
          givenName: normalizedUser.givenName,
          mobileNumber: normalizedUser.mobileNumber,
          tier: normalizedUser.tier,
          role: normalizedUser.role,
          walletAddress: normalizedUser.walletAddress
        }),
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60,
        path: "/"
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
  });

export default Student;
