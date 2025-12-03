import Elysia, { t } from "elysia";
import StudentService from "../services/auth.services/student.service";
import { refreshAuthCookie } from "../utils/refreshCookie";

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
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
  });

export default Student;
