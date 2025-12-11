//** ELYSIA IMPORT */
import Elysia, { t } from "elysia";

//** SERVICE IMPORT */
import AuthService from "../services/auth.services/tutor.service";
import { TutorService } from "../services/tutor.services/tutor.service";
import { LoginSchema, RegisterSchema, LogoutSchema, MeSchema, UpdatePersonalInfoSchema, UpdateEmailSchema, UpdatePasswordSchema } from "../services/auth.services/auth.schema";
import type { AuthData, LoginReturnParams, MeResponse } from "@/services/auth.services/auth.interface";
import { refreshAuthCookie } from "../utils/refreshCookie";

// Define routes as an Elysia plugin instance to preserve route types
const Auth = new Elysia({ name: 'auth', prefix: '/tutor' })
    .post('/register', async ({ body, cookie }) => {
      try 
      {
        const authService = new AuthService();
        const result = await authService.register(body);

        // Immediately log the user in after successful registration
        const userData: LoginReturnParams = await authService.login({ email: body.email, password: body.password });

        // Set httpOnly cookie with 1-hour expiration and basic profile
        cookie.tutorAuth?.set({
          value: JSON.stringify({
            userId: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            walletAddress: userData.walletAddress,
            mobileNumber: userData.mobileNumber,
            tier: userData.tier

          }),
          httpOnly: true,
          secure: false, // False for localhost HTTP dev
          sameSite: 'lax', // Lax works for localhost same-site
          maxAge: 60 * 60,
          path: '/'
        });

        return {
          success: true,
          message: result.message,
          user: {
            ...userData,
            userId: userData.id
          }
        };
        
      } catch (error: any) {
        console.log(error)
        throw error;
      }

      }, RegisterSchema)


    .post('/login', async ({ body, cookie }) => {
      try {
        const authService = new AuthService();
        const userData = await authService.login(body);
      
        // Handle smartWalletAddress - it might be a string or object from DB


        // Normalize user object (same pattern as student app)
        const normalizedUser = {
          id: userData.id,
          userId: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          mobileNumber: userData.mobileNumber,
          tier: userData.tier,
          role: userData.role || 'tutor',
          walletAddress: userData.walletAddress
        };

        // Set cookie - don't specify domain for localhost to work correctly
        cookie.tutorAuth?.set({
          value: JSON.stringify({
            userId: normalizedUser.userId,
            email: normalizedUser.email,
            firstName: normalizedUser.firstName,
            lastName: normalizedUser.lastName,
            mobileNumber: normalizedUser.mobileNumber,
            tier: normalizedUser.tier,
            role: normalizedUser.role,
            walletAddress: normalizedUser.walletAddress
          }),
          httpOnly: true,
          secure: false, // False for localhost HTTP
          sameSite: "lax", // Lax works for localhost
          maxAge: 60 * 60, // 1 hour
          path: "/",
          // Don't set domain - let browser default to current host
        });
        
        return { success: true,user: normalizedUser };
      } catch (error: any) {
        console.log(error);
        throw error;
      }
    }, LoginSchema)
    
    .post('/logout', async ({ cookie, set }) => {
      // Aggressively clear the cookie with all possible methods
      cookie.tutorAuth?.set({
        value: '',
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        expires: new Date(0), // Also set explicit past date
        path: '/'
      });
      cookie.tutorAuth?.remove();
      
      // Set headers to prevent caching
      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      
      return { success: true, message: 'Logged out successfully' };
    }, LogoutSchema)
    
    // Renew session cookie (extends maxAge) without re-authenticating
    .post('/refresh', async ({ cookie, set, headers }) => {
      const raw = cookie.tutorAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      refreshAuthCookie(cookie, authData, 'tutorAuth');

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';
      return { success: true };
    })

    // Alias for /refresh at /tutor/refresh path
    .post('/tutor/refresh', async ({ cookie, set, headers }) => {
      const raw = cookie.tutorAuth?.value;
      if (!raw) throw new Error('Not authenticated');
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      refreshAuthCookie(cookie, authData, 'tutorAuth');

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';
      return { success: true };
    })
    
    .get('/me', async ({ cookie, set }): Promise<MeResponse> => {
      try {
        const raw = cookie.tutorAuth?.value;
        if (!raw) {
          throw new Error('Not authenticated');
        }
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        // Refresh cookie on every /me call
        refreshAuthCookie(cookie, authData, 'tutorAuth');

        // Fetch profile picture from database
        const tutorService = new TutorService();
        const profilePicture = await tutorService.getCurrentProfilePicture(authData.userId);

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';
        set.headers['Vary'] = 'Cookie';
        return { user: {
          userId: authData.userId,
          email: authData.email,
          firstName: authData.firstName ?? undefined,
          lastName: authData.lastName ?? undefined,
          walletAddress: authData.walletAddress ?? undefined,
          mobileNumber: authData.mobileNumber ?? undefined,
          tier: authData.tier,
          profilePicture: profilePicture ?? undefined
        } };
      } catch (error: any) {
        throw new Error('Invalid session');
      }
    }, MeSchema)

    .put('/user/personal-info', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.tutorAuth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updatePersonalInfo({
          userId: authData.userId,
          ...body
        });

        // Update mobileNumber in cookie if phoneNumber was updated
        if (body.phoneNumber) {
          authData.mobileNumber = body.phoneNumber;
        }
        
        // Refresh cookie with 1-hour expiry
        refreshAuthCookie(cookie, authData, 'tutorAuth');

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';

        return { success: true, message: result.message };
      } catch (error: any) {
        console.error('Error updating personal info:', error);
        throw error;
      }
    }, UpdatePersonalInfoSchema)

    .get('/user/personal-info', async ({ cookie, set }) => {
      try {
        const raw = cookie.tutorAuth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.getPersonalInfo(authData.userId);

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';

        return { success: true, data: result };
      } catch (error: any) {
        console.error('Error getting personal info:', error);
        throw error;
      }
    })

    .put('/user/email', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.tutorAuth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updateEmail({
          userId: authData.userId,
          newEmail: body.newEmail,
          currentPassword: body.currentPassword
        });

        // Update email in cookie and refresh with 1-hour expiry
        authData.email = body.newEmail.toLowerCase();
        refreshAuthCookie(cookie, authData, 'tutorAuth');

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';

        return { success: true, message: result.message };
      } catch (error: any) {
        console.error('Error updating email:', error);
        throw error;
      }
    }, UpdateEmailSchema)

    .put('/user/password', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.tutorAuth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updatePassword({
          userId: authData.userId,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword
        });

        // Refresh cookie with 1-hour expiry
        refreshAuthCookie(cookie, authData, 'tutorAuth');

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';

        return { success: true, message: result.message };
      } catch (error: any) {
        console.error('Error updating password:', error);
        throw error;
      }
    }, UpdatePasswordSchema)


export default Auth;