//** NANOID IMPORT */
import { nanoid } from "nanoid"

//** BCRYPT IMPORT
import { hash, compare } from 'bcrypt-ts'

//** TYPE IMPORT */
import type { LoginParams, RegisteredParams, RegisterParams, Suspended, UpdatePersonalInfoParams, UpdateEmailParams, UpdatePasswordParams } from "./auth.interface";
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
                updates.push('u.mobileNumber = $phoneNumber');
                queryParams.phoneNumber = phoneNumber;
            }
            if (country !== undefined) {
                updates.push('u.country = $country');
                queryParams.country = country;
            }
            if (region !== undefined) {
                updates.push('u.region = $region');
                queryParams.region = region;
            }
            if (regionName !== undefined) {
                updates.push('u.regionName = $regionName');
                queryParams.regionName = regionName;
            }
            if (province !== undefined) {
                updates.push('u.province = $province');
                queryParams.province = province;
            }
            if (provinceName !== undefined) {
                updates.push('u.provinceName = $provinceName');
                queryParams.provinceName = provinceName;
            }
            if (city !== undefined) {
                updates.push('u.city = $city');
                queryParams.city = city;
            }
            if (cityName !== undefined) {
                updates.push('u.cityName = $cityName');
                queryParams.cityName = cityName;
            }
            if (zipCode !== undefined) {
                updates.push('u.zipCode = $zipCode');
                queryParams.zipCode = zipCode;
            }
            if (addressLine !== undefined) {
                updates.push('u.addressLine = $addressLine');
                queryParams.addressLine = addressLine;
            }
            if (sameAsPermanent !== undefined) {
                updates.push('u.sameAsPermanent = $sameAsPermanent');
                queryParams.sameAsPermanent = sameAsPermanent;
            }
            if (schoolAttended !== undefined) {
                updates.push('u.schoolAttended = $schoolAttended');
                queryParams.schoolAttended = schoolAttended;
            }
            if (educationalAttainment !== undefined) {
                updates.push('u.educationalAttainment = $educationalAttainment');
                queryParams.educationalAttainment = educationalAttainment;
            }
            if (major !== undefined) {
                updates.push('u.major = $major');
                queryParams.major = major;
            }
            if (teachingExperience !== undefined) {
                updates.push('u.teachingExperience = $teachingExperience');
                queryParams.teachingExperience = teachingExperience;
            }
            if (teachingQualifications !== undefined) {
                updates.push('u.teachingQualifications = $teachingQualifications');
                queryParams.teachingQualifications = teachingQualifications;
            }
            if (currentProficiency !== undefined) {
                updates.push('u.currentProficiency = $currentProficiency');
                queryParams.currentProficiency = currentProficiency;
            }
            if (learningGoals !== undefined) {
                updates.push('u.learningGoals = $learningGoals');
                queryParams.learningGoals = learningGoals;
            }
            if (preferredLearningStyle !== undefined) {
                updates.push('u.preferredLearningStyle = $preferredLearningStyle');
                queryParams.preferredLearningStyle = preferredLearningStyle;
            }
            if (availability !== undefined) {
                updates.push('u.availability = $availability');
                queryParams.availability = availability;
            }

            if (updates.length === 0) {
                return { message: 'No fields to update' };
            }

            await session.run(
                `
                MATCH (u:User { id: $userId })
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
            const userResult = await session.run(
                `
                MATCH (u:User { id: $userId })
                RETURN u.password as password, u.email as currentEmail
                `,
                { userId }
            );

            if (userResult.records.length === 0) {
                await session.close();
                throw new Error('User not found');
            }

            const encryptedPassword = userResult.records[0]?.get('password');
            const currentEmail = userResult.records[0]?.get('currentEmail');
            
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
                MATCH (u:User { email: $newEmail })
                RETURN u
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
                MATCH (u:User { id: $userId })
                SET u.email = $newEmail, u.verifiedEmail = false
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
            const userResult = await session.run(
                `
                MATCH (u:User { id: $userId })
                RETURN u.password as password
                `,
                { userId }
            );

            if (userResult.records.length === 0) {
                await session.close();
                throw new Error('User not found');
            }

            const encryptedPassword = userResult.records[0]?.get('password');
            
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
                MATCH (u:User { id: $userId })
                SET u.password = $newPassword, u.signUpdate = $signUpdate
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





    
}

export default AuthService