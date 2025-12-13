import { nanoid } from "nanoid";
import { hash, compare } from "bcrypt-ts";
import { getDriver } from "../../db/memgraph";
import type { RegisterParams, LoginParams, RegisteredParams, Suspended, RegisterStudentParams, UpdatePersonalInfoParams, UpdateEmailParams, UpdatePasswordParams } from "./auth.interface";
import WalletService from "../wallet.services/wallet.service";

class StudentService {
  public async register(params: RegisterStudentParams & { familyName: string; givenName: string }): Promise<{ message: string }> {
    try {
      const id = nanoid(12);
      const signUpdate = Date.now();
      const suspended: Suspended = { until: null, reason: "" };
      const { email, password, familyName, givenName, birthDate, mobileNumber } = params;

      const walletService = new WalletService();
      const [encrypted, smartWalletAddress] = await Promise.all([
          hash(password, 10), // Reduced salt rounds for performance
          walletService.createServerWallet(id)
      ]);
      const driver = getDriver();
      const session = driver.session();

      // Check if email already exists in Student nodes
      const studentExistsResult = await session.run(
        `MATCH (s:Student { email: $email }) RETURN s LIMIT 1`,
        { email }
      );
      if (studentExistsResult.records.length > 0) {
        await session.close();
        const err: any = new Error('EMAIL_EXISTS');
        err.code = 'EMAIL_EXISTS';
        throw err;
      }

      // Check if email already exists in User (tutor) nodes
      const tutorExistsResult = await session.run(
        `MATCH (u:User { email: $email }) RETURN u LIMIT 1`,
        { email }
      );
      if (tutorExistsResult.records.length > 0) {
        await session.close();
        const err: any = new Error('EMAIL_EXISTS');
        err.code = 'EMAIL_EXISTS';
        throw err;
      }

      await session.run(
        `CREATE (s:Student {
          id: $id,
          email: $email,
          password: $encrypted,
          role: 'student',
          familyName: $familyName,
          givenName: $givenName,
          birthDate: $birthDate,
          mobileNumber: $mobileNumber,
          signUpdate: $signUpdate,
          suspendedUntil: $suspendedUntil,
          suspendedReason: $suspendedReason,
          smartWalletAddress: $smartWalletAddress,
          verifiedEmail: false,
          verifiedMobile: false
        })`,
        {
          id,
          email,
          encrypted,
          familyName,
          givenName,
          birthDate,
          mobileNumber,
          signUpdate,
          suspendedUntil: suspended.until,
          suspendedReason: suspended.reason,
          smartWalletAddress
        }
      );
      await session.close();
      return { message: "Registration successful" };
    } catch (error: any) {
      console.error("Student registration error:", error);
      throw error;
    }
  }

  public async login(params: LoginParams): Promise<any> {
    try {
      const driver = getDriver();
      const session = driver.session();
      const result = await session.run(
        `MATCH (s:Student { email: $email }) RETURN s`,
        { email: params.email }
      );
      await session.close();
      if (result.records.length === 0) {
        throw new Error("Invalid email or password");
      }
      const user = result.records[0]?.get("s").properties;
      
      // Check if user is suspended
      if (user.suspendedUntil) {
        const suspendedUntil = new Date(user.suspendedUntil);
        if (suspendedUntil > new Date()) {
          const formattedDate = suspendedUntil.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          throw new Error(`Your account is suspended until ${formattedDate}. Reason: ${user.suspendedReason || 'Not specified'}`);
        }
      }
      
      const encryptedPassword: string = user.password;
      const isPasswordValid = await compare(params.password, encryptedPassword);
      if (!isPasswordValid) {
        throw new Error("Invalid email or password");
      }
      const { password, tier, ...safeProperties } = user;
      const tierNumber = Number(tier);
      return {
        ...safeProperties,
        tier: tierNumber
      };
    } catch (error: any) {
      console.error("Student login error:", error);
      throw error;
    }
  }

  public async updatePersonalInfo(params: UpdatePersonalInfoParams): Promise<{ message: string }> {
    try {
      const driver = getDriver();
      const session = driver.session();

      const {
        userId,
        phoneNumber,
        country,
        region,
        regionName,
        province,
        provinceName,
        city,
        cityName,
        zipCode,
        addressLine,
        sameAsPermanent,
        schoolAttended,
        educationalAttainment,
        major,
        teachingExperience,
        teachingQualifications,
        currentProficiency,
        learningGoals,
        preferredLearningStyle,
        availability
      } = params;

      // Build dynamic SET clause for only provided fields
      const updates: string[] = [];
      const queryParams: Record<string, any> = { userId };

      if (phoneNumber !== undefined) {
        updates.push('s.mobileNumber = $phoneNumber');
        queryParams.phoneNumber = phoneNumber;
      }
      if (country !== undefined) {
        updates.push('s.country = $country');
        queryParams.country = country;
      }
      if (region !== undefined) {
        updates.push('s.region = $region');
        queryParams.region = region;
      }
      if (regionName !== undefined) {
        updates.push('s.regionName = $regionName');
        queryParams.regionName = regionName;
      }
      if (province !== undefined) {
        updates.push('s.province = $province');
        queryParams.province = province;
      }
      if (provinceName !== undefined) {
        updates.push('s.provinceName = $provinceName');
        queryParams.provinceName = provinceName;
      }
      if (city !== undefined) {
        updates.push('s.city = $city');
        queryParams.city = city;
      }
      if (cityName !== undefined) {
        updates.push('s.cityName = $cityName');
        queryParams.cityName = cityName;
      }
      if (zipCode !== undefined) {
        updates.push('s.zipCode = $zipCode');
        queryParams.zipCode = zipCode;
      }
      if (addressLine !== undefined) {
        updates.push('s.addressLine = $addressLine');
        queryParams.addressLine = addressLine;
      }
      if (sameAsPermanent !== undefined) {
        updates.push('s.sameAsPermanent = $sameAsPermanent');
        queryParams.sameAsPermanent = sameAsPermanent;
      }
      if (schoolAttended !== undefined) {
        updates.push('s.schoolAttended = $schoolAttended');
        queryParams.schoolAttended = schoolAttended;
      }
      if (educationalAttainment !== undefined) {
        updates.push('s.educationalAttainment = $educationalAttainment');
        queryParams.educationalAttainment = educationalAttainment;
      }
      if (major !== undefined) {
        updates.push('s.major = $major');
        queryParams.major = major;
      }
      if (teachingExperience !== undefined) {
        updates.push('s.teachingExperience = $teachingExperience');
        queryParams.teachingExperience = teachingExperience;
      }
      if (teachingQualifications !== undefined) {
        updates.push('s.teachingQualifications = $teachingQualifications');
        queryParams.teachingQualifications = teachingQualifications;
      }
      if (currentProficiency !== undefined) {
        updates.push('s.currentProficiency = $currentProficiency');
        queryParams.currentProficiency = currentProficiency;
      }
      if (learningGoals !== undefined) {
        updates.push('s.learningGoals = $learningGoals');
        queryParams.learningGoals = learningGoals;
      }
      if (preferredLearningStyle !== undefined) {
        updates.push('s.preferredLearningStyle = $preferredLearningStyle');
        queryParams.preferredLearningStyle = preferredLearningStyle;
      }
      if (availability !== undefined) {
        updates.push('s.availability = $availability');
        queryParams.availability = availability;
      }

      if (updates.length === 0) {
        return { message: 'No fields to update' };
      }

      await session.run(
        `
        MATCH (s:Student { id: $userId })
        SET ${updates.join(', ')}
        `,
        queryParams
      );

      await session.close();
      return { message: 'Personal information updated successfully' };
    } catch (error: any) {
      console.error('Update personal info error:', error);
      throw error;
    }
  }

  public async updateEmail(params: UpdateEmailParams): Promise<{ message: string }> {
    try {
      const driver = getDriver();
      const session = driver.session();

      const { userId, newEmail, currentPassword } = params;

      // First, verify the current password
      const studentResult = await session.run(
        `
        MATCH (s:Student { id: $userId })
        RETURN s.password as password, s.email as currentEmail
        `,
        { userId }
      );

      if (studentResult.records.length === 0) {
        await session.close();
        throw new Error('Student not found');
      }

      const encryptedPassword = studentResult.records[0]?.get('password');
      const currentEmail = studentResult.records[0]?.get('currentEmail');
      
      const isPasswordValid = await compare(currentPassword, encryptedPassword);
      if (!isPasswordValid) {
        await session.close();
        throw new Error('Current password is incorrect');
      }

      // Check if new email is the same as current
      if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
        await session.close();
        throw new Error('New email must be different from current email');
      }

      // Check if the new email is already in use
      const emailCheck = await session.run(
        `
        MATCH (s:Student { email: $newEmail })
        RETURN s
        `,
        { newEmail: newEmail.toLowerCase() }
      );

      if (emailCheck.records.length > 0) {
        await session.close();
        throw new Error('Email is already in use');
      }

      // Update the email
      await session.run(
        `
        MATCH (s:Student { id: $userId })
        SET s.email = $newEmail, s.verifiedEmail = false
        `,
        { userId, newEmail: newEmail.toLowerCase() }
      );

      await session.close();
      return { message: 'Email updated successfully' };
    } catch (error: any) {
      console.error('Update email error:', error);
      throw error;
    }
  }

  public async updatePassword(params: UpdatePasswordParams): Promise<{ message: string }> {
    try {
      const driver = getDriver();
      const session = driver.session();

      const { userId, currentPassword, newPassword } = params;

      // First, verify the current password
      const studentResult = await session.run(
        `
        MATCH (s:Student { id: $userId })
        RETURN s.password as password
        `,
        { userId }
      );

      if (studentResult.records.length === 0) {
        await session.close();
        throw new Error('Student not found');
      }

      const encryptedPassword = studentResult.records[0]?.get('password');
      
      const isPasswordValid = await compare(currentPassword, encryptedPassword);
      if (!isPasswordValid) {
        await session.close();
        throw new Error('Current password is incorrect');
      }

      // Check if new password is different from current
      const isSamePassword = await compare(newPassword, encryptedPassword);
      if (isSamePassword) {
        await session.close();
        throw new Error('New password must be different from current password');
      }

      // Hash the new password
      const newEncryptedPassword = await hash(newPassword, 10);

      // Update the password
      await session.run(
        `
        MATCH (s:Student { id: $userId })
        SET s.password = $newPassword, s.signUpdate = $signUpdate
        `,
        { userId, newPassword: newEncryptedPassword, signUpdate: Date.now() }
      );

      await session.close();
      return { message: 'Password updated successfully' };
    } catch (error: any) {
      console.error('Update password error:', error);
      throw error;
    }
  }

  /**
   * Authenticate or check registration status by wallet address
   * Returns user data if wallet exists and registration is complete
   * Returns partial status if wallet exists but registration incomplete
   * Returns null if wallet doesn't exist (needs registration)
   */
  public async loginByWallet(walletAddress: string): Promise<{
    status: 'authenticated' | 'incomplete_registration' | 'not_found';
    user: any | null;
    missingFields?: string[];
  }> {
    try {
      const driver = getDriver();
      const session = driver.session();
      
      // Search for student by wallet address (could be smartWalletAddress from server wallet or external wallet)
      const result = await session.run(
        `MATCH (s:Student)
         WHERE s.smartWalletAddress = $walletAddress 
            OR s.externalWalletAddress = $walletAddress
         RETURN s`,
        { walletAddress: walletAddress.toLowerCase() }
      );
      await session.close();

      if (result.records.length === 0) {
        // Wallet not found - user needs to register
        return { status: 'not_found', user: null };
      }

      const user = result.records[0]?.get('s').properties;
      
      // Check if user is suspended
      if (user.suspendedUntil) {
        const suspendedUntil = new Date(user.suspendedUntil);
        if (suspendedUntil > new Date()) {
          const formattedDate = suspendedUntil.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          throw new Error(`Your account is suspended until ${formattedDate}. Reason: ${user.suspendedReason || 'Not specified'}`);
        }
      }

      // Check for required fields to determine if registration is complete
      const requiredFields = ['email', 'givenName', 'familyName'];
      const missingFields = requiredFields.filter(field => !user[field]);

      if (missingFields.length > 0) {
        // Registration incomplete - return partial user with missing fields info
        const { password, ...safeUser } = user;
        return {
          status: 'incomplete_registration',
          user: { ...safeUser, tier: Number(user.tier) || 0 },
          missingFields
        };
      }

      // Full authentication - return user data
      const { password, tier, ...safeProperties } = user;
      return {
        status: 'authenticated',
        user: {
          ...safeProperties,
          tier: Number(tier) || 0
        }
      };
    } catch (error: any) {
      console.error('Wallet login error:', error);
      throw error;
    }
  }

  /**
   * Register a new student with wallet address (from Thirdweb social login)
   * Creates a new student node linked to the external wallet address
   */
  public async registerByWallet(params: {
    walletAddress: string;
    email?: string;
    givenName?: string;
    familyName?: string;
    birthDate?: string;
    mobileNumber?: string;
  }): Promise<{ message: string; user: any }> {
    try {
      const id = nanoid(12);
      const signUpdate = Date.now();
      const { walletAddress, email, givenName, familyName, birthDate, mobileNumber } = params;

      const driver = getDriver();
      const session = driver.session();

      // Check if wallet address already exists
      const walletExists = await session.run(
        `MATCH (s:Student)
         WHERE s.smartWalletAddress = $walletAddress 
            OR s.externalWalletAddress = $walletAddress
         RETURN s LIMIT 1`,
        { walletAddress: walletAddress.toLowerCase() }
      );

      if (walletExists.records.length > 0) {
        await session.close();
        const err: any = new Error('WALLET_EXISTS');
        err.code = 'WALLET_EXISTS';
        throw err;
      }

      // Check if email already exists (if provided)
      if (email) {
        const emailExists = await session.run(
          `MATCH (s:Student { email: $email }) RETURN s LIMIT 1`,
          { email: email.toLowerCase() }
        );
        if (emailExists.records.length > 0) {
          await session.close();
          const err: any = new Error('EMAIL_EXISTS');
          err.code = 'EMAIL_EXISTS';
          throw err;
        }
      }

      // Create student with wallet address (no password required for wallet-based auth)
      await session.run(
        `CREATE (s:Student {
          id: $id,
          email: $email,
          role: 'student',
          familyName: $familyName,
          givenName: $givenName,
          birthDate: $birthDate,
          mobileNumber: $mobileNumber,
          signUpdate: $signUpdate,
          suspendedUntil: null,
          suspendedReason: '',
          externalWalletAddress: $walletAddress,
          verifiedEmail: false,
          verifiedMobile: false,
          tier: 0
        })`,
        {
          id,
          email: email ? email.toLowerCase() : null,
          familyName: familyName || null,
          givenName: givenName || null,
          birthDate: birthDate || null,
          mobileNumber: mobileNumber || null,
          signUpdate,
          walletAddress: walletAddress.toLowerCase()
        }
      );

      // Fetch the created user
      const result = await session.run(
        `MATCH (s:Student { id: $id }) RETURN s`,
        { id }
      );
      await session.close();

      const user = result.records[0]?.get('s').properties;
      const { password: _, ...safeUser } = user;

      return {
        message: 'Registration successful',
        user: safeUser
      };
    } catch (error: any) {
      console.error('Wallet registration error:', error);
      throw error;
    }
  }

  /**
   * Link an external wallet address to an existing student account
   */
  public async linkWallet(userId: string, walletAddress: string): Promise<{ message: string }> {
    try {
      const driver = getDriver();
      const session = driver.session();

      // Check if wallet is already linked to another account
      const walletExists = await session.run(
        `MATCH (s:Student)
         WHERE (s.smartWalletAddress = $walletAddress OR s.externalWalletAddress = $walletAddress)
           AND s.id <> $userId
         RETURN s LIMIT 1`,
        { walletAddress: walletAddress.toLowerCase(), userId }
      );

      if (walletExists.records.length > 0) {
        await session.close();
        throw new Error('This wallet is already linked to another account');
      }

      await session.run(
        `MATCH (s:Student { id: $userId })
         SET s.externalWalletAddress = $walletAddress`,
        { userId, walletAddress: walletAddress.toLowerCase() }
      );

      await session.close();
      return { message: 'Wallet linked successfully' };
    } catch (error: any) {
      console.error('Link wallet error:', error);
      throw error;
    }
  }
}

export default StudentService;
