// Axios client
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
    const { data } = await client.post('/login', { email, password })
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