export interface FarmCoordinates {
  lat: number;
  lng: number;
}

export interface FarmList {
  owner: string;
  farmName: string;
  id: string;
  cropType: string;
  description: string;
  image: string;
  coordinates: FarmCoordinates;
  updatedAt: string;
  createdAt: string;
  formattedUpdatedAt: string;
  formattedCreatedAt: string;
  imageBytes?: Uint8Array;
  location: string;
}

export interface ParsedInterpretation {
  diagnosis: string;
  reason: string;
  recommendations: string[];
  historicalComparison?: string;
}

export interface PlantScanResult {
  cropType: string;
  note: string;
  createdAt: string;
  formattedCreatedAt: string;
  id: string;
  interpretation: string | ParsedInterpretation;
  imageUri: string;
  imageBytes?: number[]; // Changed from Uint8Array to number[] to match backend
}

export interface SensorReadings {
  fertility: number;
  moisture: number;
  ph: number;
  temperature: number;
  sunlight: number;
  humidity: number;
  farmName: string;
  cropType: string;
  sensorId: string;
  id: string;
  createdAt: string;
  submittedAt: string;
  formattedCreatedAt: string;
  formattedSubmittedAt: string;
}

export interface Interpretation {
  evaluation: string;
  fertility: string;
  moisture: string;
  ph: string;
  temperature: string;
  sunlight: string;
  humidity: string;
  historicalComparison?: string;
}

export interface SensorReadingsWithInterpretation {
  fertility: number;
  moisture: number;
  ph: number;
  temperature: number;
  sunlight: number;
  humidity: number;
  farmName: string;
  cropType: string;
  sensorId: string;
  id: string;
  createdAt: string;
  submittedAt: string;
  formattedCreatedAt: string;
  formattedSubmittedAt: string;
  interpretation: Interpretation;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FarmScanResult {
  plantScans: PlantScanResult[];
  soilReadings: SensorReadingsWithInterpretation[];
  pagination: PaginationInfo;
}
