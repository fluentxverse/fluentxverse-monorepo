//** API EDEN TREATY IMPORT */
import { api } from "../api";
//** TYPE IMPORTS */
import type { FarmList, CreatedFarm, FarmData, UpdatedFarm } from "@server/farmer.services/farmer.interface";
import type { SuccessMessage } from "@server/onchain.services/onchain.interface";
import { getCookie } from "@/client/weather/clientWeather";
/**
 * Get all farm lists (GET /farm/list)
 */
export async function getFarmList(): Promise<FarmList[] | Error> {
    const jwtToken = await getCookie('accessToken');
    console.log("JWT Token:", jwtToken);
    try {
        const res = await api.farm.list.get({
            headers: {
                authorization: `Bearer ${jwtToken}`,
            },
        });
        if (!res.data) throw new Error("Get farm list failed");
        return res.data as FarmList[];
    } catch (error) {
        return error as Error;
    }
}

/**
 * Get farm data by id (GET /farm/data/:id)
 */
export async function getFarmData(id: string): Promise<CreatedFarm | Error> {
    const jwtToken = await getCookie('accessToken');
    try {
        const res = await api.farm.data({ id }).get({
            headers: {
                authorization: `Bearer ${jwtToken}`,
            },
        });
        if (!res.data) throw new Error("Get farm data failed");
        return res.data as CreatedFarm;
    } catch (error) {
        return error as Error;
    }
}

/**
 * Create a farm (POST /farm/create)
 */
export async function createFarm(body: FarmData): Promise<SuccessMessage | Error> {
    const jwtToken = await getCookie('accessToken');
    try {
        const res = await api.farm.create.post(body, {
            headers: {
                authorization: `Bearer ${jwtToken}`,
            },
        });
        if (!res.data) throw new Error("Create farm failed");
        return res.data as SuccessMessage;
    } catch (error) {
        return error as Error;
    }
}

/**
 * Update a farm (POST /farm/update)
 */
export async function updateFarm(body: UpdatedFarm): Promise<SuccessMessage | Error> {
    const jwtToken = await getCookie('accessToken');
    try {
        const res = await api.farm.update.post(body, {
            headers: {
                authorization: `Bearer ${jwtToken}`,
            },
        });
        if (!res.data) throw new Error("Update farm failed");
        return res.data as SuccessMessage;
    } catch (error) {
        return error as Error;
    }
}

/**
 * Delete a farm (POST /farm/delete/:id)
 */
export async function deleteFarm(id: string): Promise<SuccessMessage | Error> {
    const jwtToken = await getCookie('accessToken');
    try {
        const res = await api.farm.delete({ id }).post(undefined, {
            headers: {
                authorization: `Bearer ${jwtToken}`,
            },
        });
        if (!res.data) throw new Error("Delete farm failed");
        return res.data as SuccessMessage;
    } catch (error) {
        return error as Error;
    }
}