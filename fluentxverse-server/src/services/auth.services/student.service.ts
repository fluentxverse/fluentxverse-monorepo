import { nanoid } from "nanoid";
import { hash, compare } from "bcrypt-ts";
import { getDriver } from "../../db/memgraph";
import type { RegisterParams, LoginParams, RegisteredParams, Suspended, RegisterStudentParams } from "./auth.interface";
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

      // Check if email already exists to avoid unique constraint errors
      const existsResult = await session.run(
        `MATCH (s:Student { email: $email }) RETURN s LIMIT 1`,
        { email }
      );
      if (existsResult.records.length > 0) {
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
}

export default StudentService;
