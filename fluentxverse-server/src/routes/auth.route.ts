//** ELYSIA IMPORT */
import Elysia, { t } from "elysia";

//** SERVICE IMPORT */
import AuthService from "../services/auth.services/auth.service";
import { LoginSchema, RegisterSchema, LogoutSchema, MeSchema } from "../services/auth.services/auth.schema";
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
          user: userData
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
 
        // Set httpOnly cookie with 30-minute expiration using Elysia's built-in cookie
        cookie.auth?.set({
          value: JSON.stringify({
            userId: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            walletAddress: userData.smartWalletAddress.address,
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
          user: userData
        };
      } catch (error: any) {
        throw error;
      }
    }, LoginSchema)
    
    .post('/logout', async ({ cookie }) => {
      // Properly clear the cookie by setting it with expired date and matching attributes
      cookie.auth?.set({
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        path: '/'
      });
      cookie.auth?.remove();
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
          tier: authData.tier
        } };
      } catch (error: any) {
        console.error('Error parsing auth cookie:', error);
        throw new Error('Invalid session');
      }
    }, MeSchema)


export default Auth;