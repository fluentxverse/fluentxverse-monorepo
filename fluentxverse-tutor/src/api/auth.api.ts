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
    const { data } = await client.post('/tutor/register', params)
    return data;
}

export const loginUser = async (email: string, password: string) => {
  const { data } = await client.post('/tutor/login', { email, password });
  return data;
};

export const logoutUser = async () => {
    const { data } = await client.post('/tutor/logout')
    return data;
}

export const getMe = async () => {
    const { data } = await client.get('/tutor/me')
    return data;
}

export const refreshSession = async () => {
    const { data } = await client.post('/tutor/refresh')
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
    const { data } = await client.put('/tutor/user/personal-info', params)
    return data;
}

export const updateEmail = async (newEmail: string, currentPassword: string) => {
    const { data } = await client.put('/tutor/user/email', { newEmail, currentPassword })
    return data;
}

export const updatePassword = async (currentPassword: string, newPassword: string) => {
    const { data } = await client.put('/tutor/user/password', { currentPassword, newPassword })
    return data;
}