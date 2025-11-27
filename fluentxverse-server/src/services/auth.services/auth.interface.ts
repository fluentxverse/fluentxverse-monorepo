import type { Static } from '@sinclair/typebox'
import { UserSchema, MeSchema } from './auth.schema'

export interface RegisterParams {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    birthDate: string;
    mobileNumber: string;
}

// Keep User type in-sync with schema at compile time
export type User = Static<typeof UserSchema>

export type RegisteredParams = User & RegisterParams

export interface Suspended {
    until: Date | null;
    reason: string;
}

export interface LoginParams {
    email: string;
    password: string;
}

// Response types derived from schema to catch drift automatically
export type MeResponse = Static<(typeof MeSchema)["response"][200]>


// Cookie session payload. Optional fields align with MeSchema optionals.
export interface AuthData {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
    tier: number;
}