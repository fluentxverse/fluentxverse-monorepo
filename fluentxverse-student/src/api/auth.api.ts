// Axios client
import axios from "axios"
import { client } from "./utils"


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




export const getMe = async () => {
    const { data } = await client.get('/student/me')
    return data;
}

export const refreshSession = async () => {
    const { data } = await client.post('/student/refresh')
    return data;
}

export interface UpdatePersonalInfoParams {
    phoneNumber?: string;
    // Address
    country?: string;
    region?: string;
    regionName?: string;
    province?: string;
    provinceName?: string;
    city?: string;
    cityName?: string;
    zipCode?: string;
    addressLine?: string;
    sameAsPermanent?: boolean;
    // Tutor Qualifications (for tutor app)
    schoolAttended?: string;
    educationalAttainment?: string;
    major?: string;
    teachingExperience?: string;
    teachingQualifications?: string[];
    // Student Learning Preferences (for student app)
    currentProficiency?: string;
    learningGoals?: string[];
    preferredLearningStyle?: string;
    availability?: string[];
}

export const updatePersonalInfo = async (params: UpdatePersonalInfoParams) => {
    const { data } = await client.put('/student/user/personal-info', params)
    return data;
}

export const updateEmail = async (newEmail: string, currentPassword: string) => {
    const { data } = await client.put('/student/user/email', { newEmail, currentPassword })
    return data;
}

export const updatePassword = async (currentPassword: string, newPassword: string) => {
    const { data } = await client.put('/student/user/password', { currentPassword, newPassword })
    return data;
}


export interface StudentRegisterParams {
  email: string;
  password: string;
  familyName: string;
  givenName: string;
  birthDate: string;
  mobileNumber: string;
}

export const register = async (params: StudentRegisterParams) => {
  const { data } = await client.post('/student/register', params);
  return data;
};

export const loginUser = async (email: string, password: string) => {
  const { data } = await client.post('/student/login', { email, password });
  return data;
};

// Wallet-based authentication types and methods
export interface WalletAuthResponse {
  success: boolean;
  status: 'authenticated' | 'incomplete_registration' | 'not_found' | 'error';
  user: any | null;
  message: string;
  missingFields?: string[];
}

export interface WalletRegisterParams {
  walletAddress: string;
  signature: string;
  message: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  birthDate?: string;
  mobileNumber?: string;
}

export interface NonceResponse {
  success: boolean;
  nonce: string;
  message: string;
}

/**
 * Request a nonce for wallet authentication (SIWE)
 */
export const requestWalletNonce = async (walletAddress: string): Promise<NonceResponse> => {
  const { data } = await client.post('/student/auth/wallet/nonce', { walletAddress });
  return data;
};

/**
 * Authenticate user by wallet address with signature verification
 */
export const loginWithWallet = async (
  walletAddress: string,
  signature: string,
  message: string
): Promise<WalletAuthResponse> => {
  const { data } = await client.post('/student/auth/wallet', { walletAddress, signature, message });
  return data;
};

/**
 * Register a new student using wallet address with signature verification
 */
export const registerWithWallet = async (params: WalletRegisterParams) => {
  const { data } = await client.post('/student/register/wallet', params);
  return data;
};


export const logoutUser = async () => {
    const { data } = await client.post('/student/logout')
    return data;
}