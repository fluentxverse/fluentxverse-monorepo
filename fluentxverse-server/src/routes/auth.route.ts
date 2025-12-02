//** ELYSIA IMPORT */
import Elysia, { t } from "elysia";

//** SERVICE IMPORT */
import AuthService from "../services/auth.services/auth.service";
import { LoginSchema, RegisterSchema, LogoutSchema, MeSchema, UpdatePersonalInfoSchema, UpdateEmailSchema, UpdatePasswordSchema } from "../services/auth.services/auth.schema";
import type { AuthData, MeResponse, User } from "@/services/auth.services/auth.interface";

// Define routes as an Elysia plugin instance to preserve route types
const Auth = new Elysia({ name: 'auth' })
    .post('/register', async ({ body, cookie }) => {
      try 
      {
        const authService = new AuthService();
        const result = await authService.register(body);

        // Immediately log the user in after successful registration
        const userData = await authService.login({ email: body.email, password: body.password });

        // Set httpOnly cookie with 30-minute expiration and basic profile
        cookie.auth?.set({
          value: JSON.stringify({
            userId: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            walletAddress: userData.smartWalletAddress.address,
            mobileNumber: userData.mobileNumber,
            tier: userData.tier

          }),
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 60,
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


    .post('/login', async ({ body, cookie, set }) => {
      try {
        const authService = new AuthService();
        const userData = await authService.login(body);

        console.log('User data on login:', userData);
        
        // First, explicitly clear any existing auth cookie to ensure clean state
        cookie.auth?.remove();
 
        // Set fresh httpOnly cookie with 30-minute expiration
        cookie.auth?.set({
          value: JSON.stringify({
            userId: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            walletAddress: userData.smartWalletAddress.address,
            mobileNumber: userData.mobileNumber,
            tier: userData.tier
          }),
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 60, // 30 minutes in seconds
          path: '/'
        });
        
        // Prevent caching of auth responses
        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';
        set.headers['Vary'] = 'Cookie';

        return { 
          success: true,
          user: {
            ...userData,
            userId: userData.id
          }
        };
      } catch (error: any) {
        throw error;
      }
    }, LoginSchema)
    
    .post('/logout', async ({ cookie, set }) => {
      // Aggressively clear the cookie with all possible methods
      cookie.auth?.set({
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        expires: new Date(0), // Also set explicit past date
        path: '/'
      });
      cookie.auth?.remove();
      
      // Set headers to prevent caching
      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      
      return { success: true, message: 'Logged out successfully' };
    }, LogoutSchema)
    
    // Renew session cookie (extends maxAge) without re-authenticating
    .post('/refresh', async ({ cookie, set }) => {
      const raw = cookie.auth?.value;
      if (!raw) throw new Error('Not authenticated');
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

      cookie.auth?.set({
        value: JSON.stringify({
          userId: authData.userId,
          email: authData.email,
          firstName: authData.firstName,
          lastName: authData.lastName,
          walletAddress: authData.walletAddress,
          mobileNumber: authData.mobileNumber,
          tier: authData.tier
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 60,
        path: '/'
      });

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      set.headers['Pragma'] = 'no-cache';
      set.headers['Vary'] = 'Cookie';
      return { success: true };
    })
    
    .get('/me', async ({ cookie, set }): Promise<MeResponse> => {
      try {
        const raw = cookie.auth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
        console.log('Auth data from cookie:', authData);

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
          tier: authData.tier
        } };
      } catch (error: any) {
        console.error('Error parsing auth cookie:', error);
        throw new Error('Invalid session');
      }
    }, MeSchema)

    .put('/user/personal-info', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.auth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updatePersonalInfo({
          userId: authData.userId,
          ...body
        });

        // Update mobileNumber in cookie if phoneNumber was updated
        if (body.phoneNumber) {
          cookie.auth?.set({
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
        console.error('Error updating personal info:', error);
        throw error;
      }
    }, UpdatePersonalInfoSchema)

    .put('/user/email', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.auth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updateEmail({
          userId: authData.userId,
          newEmail: body.newEmail,
          currentPassword: body.currentPassword
        });

        // Update email in cookie
        cookie.auth?.set({
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
        console.error('Error updating email:', error);
        throw error;
      }
    }, UpdateEmailSchema)

    .put('/user/password', async ({ body, cookie, set }) => {
      try {
        const raw = cookie.auth?.value;
        if (!raw) throw new Error('Not authenticated');
        const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);

        const authService = new AuthService();
        const result = await authService.updatePassword({
          userId: authData.userId,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword
        });

        set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        set.headers['Pragma'] = 'no-cache';

        return { success: true, message: result.message };
      } catch (error: any) {
        console.error('Error updating password:', error);
        throw error;
      }
    }, UpdatePasswordSchema)


export default Auth;