import { FarmList as FarmData, FarmCoordinates } from '../types/farm.types';
import { API_CONFIG, getApiHeaders, handleApiResponse } from '../config/api';

// API Configuration
const API_BASE_URL = API_CONFIG.BASE_URL;

// API Service to get farm list from backend
export const fetchFarmListFromAPI = async (): Promise<FarmData[]> => {
  try {
    const headers = getApiHeaders(false); // No auth needed for public routes

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(`${API_BASE_URL}${API_CONFIG.ENDPOINTS.FARM_LIST}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return await handleApiResponse<FarmData[]>(response);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching farm list from API:', error.message);
      throw error;
    }
    throw new Error('Unknown error occurred while fetching farm list');
  }
};

// Mock data for development - updated to match Go struct
const mockFarms: FarmData[] = [
  {
    owner: '0x123456789abcdef123456789abcdef123456789ab',
    farmName: 'Sunny Fields',
    id: 'farm_001',
    cropType: 'Tomato',
    description: 'A beautiful tomato farm in the heart of Central Valley',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop',
    coordinates: {
      lat: 36.7378,
      lng: -119.7871
    },
    updatedAt: '2024-09-04T10:30:00Z',
    createdAt: '2024-08-15T08:00:00Z',
    formattedUpdatedAt: 'September 4, 2024 at 10:30 AM',
    formattedCreatedAt: 'August 15, 2024 at 8:00 AM',
    // Simple 1x1 red pixel JPEG for testing (minimal valid JPEG)
    imageBytes: [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 0, 72, 0, 72, 0, 0, 255, 219, 0, 67, 0, 8, 6, 6, 7, 6, 5, 8, 7, 7, 7, 9, 9, 8, 10, 12, 20, 13, 12, 11, 11, 12, 25, 18, 19, 15, 20, 29, 26, 31, 30, 29, 26, 28, 28, 32, 36, 46, 39, 32, 34, 44, 35, 28, 28, 40, 55, 41, 44, 48, 49, 52, 52, 52, 31, 39, 57, 61, 56, 50, 60, 46, 51, 52, 50, 255, 219, 0, 67, 1, 9, 9, 9, 12, 11, 12, 24, 13, 13, 24, 50, 33, 28, 33, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 255, 192, 0, 17, 8, 0, 1, 0, 1, 1, 1, 17, 0, 2, 17, 1, 3, 17, 1, 255, 196, 0, 20, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 196, 0, 20, 16, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 196, 0, 20, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 196, 0, 20, 17, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 218, 0, 12, 3, 1, 0, 2, 17, 3, 17, 0, 63, 0, 178, 192, 7, 255, 217],
    location: 'Central Valley, CA'
  },
  {
    owner: '0x987654321fedcba987654321fedcba987654321f',
    farmName: 'Green Pastures',
    id: 'farm_002',
    cropType: 'Wheat',
    description: 'Expansive wheat fields in the Great Plains',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
    coordinates: {
      lat: 38.4937,
      lng: -98.3804
    },
    updatedAt: '2024-09-03T14:15:00Z',
    createdAt: '2024-08-20T12:30:00Z',
    formattedUpdatedAt: 'September 3, 2024 at 2:15 PM',
    formattedCreatedAt: 'August 20, 2024 at 12:30 PM',
    imageBytes: [],
    location: 'Kansas Plains, KS'
  },
  {
    owner: '0xabcdef123456789abcdef123456789abcdef12345',
    farmName: 'Mountain View Orchard',
    id: 'farm_003',
    cropType: 'Apples',
    description: 'Organic apple orchard with mountain views',
    image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&h=600&fit=crop',
    coordinates: {
      lat: 45.7054,
      lng: -121.5215
    },
    updatedAt: '2024-09-02T09:45:00Z',
    createdAt: '2024-08-10T11:00:00Z',
    formattedUpdatedAt: 'September 2, 2024 at 9:45 AM',
    formattedCreatedAt: 'August 10, 2024 at 11:00 AM',
    imageBytes: [],
    location: 'Hood River, OR'
  }
];

export const getFarmById = async (id: string): Promise<FarmData | null> => {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      const farm = mockFarms.find(farm => farm.id === id) || null;
      resolve(farm);
    }, 500);
  });
};

export const getFarmList = async (useMockData = false): Promise<FarmData[]> => {
  if (useMockData) {
    console.log('Using mock farm data');
    // Simulate API call delay for development
    return new Promise((resolve) => {
      setTimeout(() => {
        const farms = [...mockFarms];
        console.log('Mock farms data:', farms.map(f => ({
          name: f.farmName,
          id: f.id,
          hasImageBytes: !!f.imageBytes,
          imageBytesLength: f.imageBytes?.length || 0
        })));
        resolve(farms);
      }, 500);
    });
  }

  try {
    console.log('Attempting to fetch farm data from API...');
    const farms = await fetchFarmListFromAPI();
    console.log('Successfully fetched farm data from API:', farms.length, 'farms');
    console.log('API farms data:', farms.map(f => ({
      name: f.farmName,
      id: f.id,
      hasImageBytes: !!f.imageBytes,
      imageBytesLength: f.imageBytes?.length || 0
    })));
    return farms;
  } catch (error) {
    console.warn('API call failed, falling back to mock data:', error);
    // Fallback to mock data with simulated delay
    return new Promise((resolve) => {
      setTimeout(() => {
        const farms = [...mockFarms];
        console.log('Fallback farms data:', farms.map(f => ({
          name: f.farmName,
          id: f.id,
          hasImageBytes: !!f.imageBytes,
          imageBytesLength: f.imageBytes?.length || 0
        })));
        resolve(farms);
      }, 500);
    });
  }
};

// Get a single farm by name
export const getFarmByName = async (farmName: string): Promise<FarmData | null> => {
  try {
    // First try to get from the farm list
    const farms = await getFarmList();
    const farm = farms.find(f => f.farmName === farmName);
    
    if (farm) {
      return farm;
    }
    
    // If not found in list, return null or create a basic farm object
    console.warn(`Farm with name "${farmName}" not found in farm list`);
    return null;
  } catch (error) {
    console.error('Error fetching farm by name:', error);
    return null;
  }
};
