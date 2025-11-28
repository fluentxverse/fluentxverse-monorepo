import { FarmScanResult } from '../types/farm.types';
import { API_CONFIG } from '../config/api';

export const getFarmScans = async (farmName: string, page: number = 1, limit: number = 10): Promise<FarmScanResult> => {
  try {
    console.log(`Fetching farm scans for: ${farmName}, page: ${page}, limit: ${limit}`);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FARM_SCANS}/${encodeURIComponent(farmName)}?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`API Response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch farm scans: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Received farm scan data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching farm scans:', error);
    throw error; // Don't fall back to mock data, let the UI handle the error
  }
};
