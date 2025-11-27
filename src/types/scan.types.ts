// Define the SensorReadings interface
export interface SensorReadings {
  fertility: number;
  moisture: number;
  ph: number;
  temperature: number;
  sunlight: number;
  humidity: number;
  farmName: string;
  cropType?: string;
  username: string;
  sensorId: string;
  id: string;
}

export interface SensorReadingsWithInterpretation extends Omit<SensorReadings, 'id'> {
  id: string;
  interpretation: {
    summary: string;
    recommendations: string | string[];
  };
  createdAt: string;
}


export interface ParsedInterpretation {
  Diagnosis: string;
  Reason: string;
  Recommendations: string[];
}

export interface PlantScanResult {
  id: string;
  cropType: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  interpretation: string | ParsedInterpretation;
  createdAt: string;
}

export interface FarmScanResult {
  plantScans: PlantScanResult[];
  soilReadings: SensorReadingsWithInterpretation[];
}

// Mock data for development
export const mockPlantScans: PlantScanResult[] = [
  {
    id: 'ps-1',
    cropType: 'Tomato',
    note: 'Healthy leaves, no visible issues',
    lat: 14.5995,
    lng: 120.9842,
    imageUrl: null,
    createdAt: '2023-05-15T10:30:00Z',
    interpretation: {
      Diagnosis: 'Healthy',
      Reason: 'No signs of disease or pests detected',
      Recommendations: [
        'Continue current care routine',
        'Monitor for any changes',
        'Water regularly'
      ]
    }
  },
  // Add more mock plant scans as needed
];

export const mockSoilReadings: SensorReadingsWithInterpretation[] = [
  {
    id: 'soil-1',
    moisture: 65,
    ph: 6.5,
    fertility: 75,
    temperature: 28,
    sunlight: 85,
    humidity: 60,
    farmName: 'Sample Farm',
    cropType: 'Tomato',
    username: 'user123',
    sensorId: 'sensor_123',
    createdAt: '2023-05-15T11:45:00Z',
    interpretation: {
      summary: 'Ideal soil conditions for most crops',
      recommendations: [
        'Maintain current moisture levels',
        'Monitor pH monthly',
        'Consider adding organic matter'
      ]
    }
  },
  // Add more mock soil readings as needed
];

export const mockFarmScans: FarmScanResult = {
  plantScans: mockPlantScans,
  soilReadings: mockSoilReadings
};
