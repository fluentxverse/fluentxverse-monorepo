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


export const logoutUser = async () => {
    const { data } = await client.post('/student/logout')
    return data;
}