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
  imageBytes: number[];
  location: string;
}

// ParsedInterpretation represents the parsed interpretation of a plant scan result
// Note: Field names are lowercase to match actual API response
export interface ParsedInterpretation {
  diagnosis: string;
  reason: string;
  recommendations: string[];
  historicalComparison?: string;
}

// PlantScanResult represents a plant scan with analysis
export interface PlantScanResult {
  cropType: string;
  note: string | null;
  createdAt: string; // ISO 8601 format
  formattedCreatedAt: string; // e.g. "July 15, 2025 - 12:00pm"
  id: string;
  interpretation: ParsedInterpretation | string | null;
  imageUri: string;
  imageBytes: number[]; // Array of numbers (packed byte array)
}

// SensorReadings represents sensor data collected from agricultural sensors
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

// Interpretation contains human-readable interpretations of sensor readings
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

// SensorReadingsWithInterpretation extends SensorReadings to include AI-generated interpretations
export interface SensorReadingsWithInterpretation extends SensorReadings {
  interpretation: Interpretation;
}

// FarmScanResult represents the result of farm scans
export interface FarmScanResult {
  plantScans: PlantScanResult[];
  soilReadings: SensorReadingsWithInterpretation[];
  pagination?: PaginationInfo; // Made optional since it may not always be present
}

// PaginationInfo contains pagination metadata
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}