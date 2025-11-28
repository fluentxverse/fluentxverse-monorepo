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


export const register = async (params: RegisterParams) => {
    const { data } = await client.post('/register', params)
    return data;
}

export const loginUser = async (email: string, password: string) => {
    // Use a fresh axios instance for login to avoid any stale state/interceptor issues
    const freshClient = axios.create({
        baseURL: 'http://localhost:8765',
        withCredentials: true,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        }
    });
    const { data } = await freshClient.post('/login', { email, password }, {
        params: { _t: Date.now() }
    });
    return data;
}

export const logoutUser = async () => {
    const { data } = await client.post('/logout')
    return data;
}

export const getMe = async () => {
    const { data } = await client.get('/me')
    return data;
}

export const refreshSession = async () => {
    const { data } = await client.post('/refresh')
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
    // Qualifications
    schoolAttended?: string;
    educationalAttainment?: string;
    major?: string;
    teachingExperience?: string;
    teachingQualifications?: string[];
}

export const updatePersonalInfo = async (params: UpdatePersonalInfoParams) => {
    const { data } = await client.put('/user/personal-info', params)
    return data;
}

export const updateEmail = async (newEmail: string, currentPassword: string) => {
    const { data } = await client.put('/user/email', { newEmail, currentPassword })
    return data;
}

export const updatePassword = async (currentPassword: string, newPassword: string) => {
    const { data } = await client.put('/user/password', { currentPassword, newPassword })
    return data;
}