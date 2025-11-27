//** NANOID IMPORT */
import { nanoid } from "nanoid"

//** BCRYPT IMPORT
import { hash, compare } from 'bcrypt-ts'

//** TYPE IMPORT */
import type { LoginParams, RegisteredParams, RegisterParams, Suspended } from "./auth.interface";
import WalletService from "../wallet.services/wallet.service";
import { getDriver } from "../../db/memgraph";



class AuthService {
    public async register (params: RegisterParams): Promise<{ message: string }> {
        try {   
        const walletService = new WalletService();
        const id = nanoid(12);
        const signUpdate = Date.now();

        const suspended: Suspended = { until: null, reason: "" };
        const { email, password, firstName, middleName, lastName, suffix, birthDate, mobileNumber } = params;

        
        const [encrypted, smartWalletAddress] = await Promise.all([
            hash(password, 10), // Reduced salt rounds for performance
            walletService.createServerWallet(id)
        ]);

        const driver = getDriver();
        const session = driver.session();

        await session.run(
            `
            CREATE (u:User {
                id: $id,
                email: $email,
                password: $encrypted,

                tier: 0,

                firstName: $firstName,
                middleName: $middleName,
                lastName: $lastName,
                suffix: $suffix,
                birthDate: $birthDate,

                mobileNumber: $mobileNumber,
                smartWalletAddress: $smartWalletAddress,

                signUpdate: $signUpdate,
                suspendedUntil: $suspendedUntil,
                suspendedReason: $suspendedReason,

                verifiedEmail: false,
                verifiedMobile: false
            })
            `,
            {
                id,
                email,
                encrypted,
                firstName,
                middleName: middleName || "",
                lastName,
                suffix: suffix || "",
                birthDate,
                mobileNumber,
                smartWalletAddress,
                signUpdate,
                suspendedUntil: suspended.until,
                suspendedReason: suspended.reason
            }
        );

        await session.close();
        return { message: "Registration successful" };
    } catch (error: any) {
        console.error('Registration error:', error);
        throw error;
    }
    }


    public async login (params: LoginParams): Promise<Omit<RegisteredParams, 'password'>> {

        try {
        const driver = getDriver();
        const session = driver.session();

        const result = await session.run(
            `
            MATCH (u:User { email: $email })
            RETURN u
            `,
            { email: params.email }
        );

        await session.close();

        if (result.records.length === 0) {
            throw new Error('Invalid email or password');
        }

        const encryptedPassword: string = result.records[0]?.get('u').properties.password;
        const isPasswordValid = await compare(params.password, encryptedPassword);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        const user: RegisteredParams = result.records[0]?.get('u').properties;

        const {  password, tier, ...safeProperties    } = user
        const tierNumber = Number(tier);

        const safeUser: Omit<RegisteredParams, 'password'> = {
            ...safeProperties,
            tier: tierNumber
        };

        return safeUser;
    }
    catch (error: any) {
        console.error('Login error:', error);
        throw error;
    }

    }




    


    


}

export default AuthService