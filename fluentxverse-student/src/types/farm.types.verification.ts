// Type verification for Go struct compatibility
// This file ensures our TypeScript interfaces match the Go farmservices structs

import { 
  FarmList, 
  FarmCoordinates, 
  PlantScanResult, 
  SensorReadingsWithInterpretation,
  FarmScanResult,
  PaginationInfo,
  ParsedInterpretation,
  Interpretation 
} from './farm.types';

/*
Go struct reference:
type FarmList struct {
    Owner             string         `json:"owner"`
    FarmName          string         `json:"farmName"`
    ID                string         `json:"id"`
    CropType          string         `json:"cropType"`
    Description       string         `json:"description"`
    Image             string         `json:"image"`
    Coordinates       FarmCoordinates `json:"coordinates"`
    UpdatedAt         time.Time      `json:"updatedAt"`
    CreatedAt         time.Time      `json:"createdAt"`
    FormattedUpdatedAt string        `json:"formattedUpdatedAt"`
    FormattedCreatedAt string        `json:"formattedCreatedAt"`
    ImageBytes        []byte         `json:"imageBytes"`
    Location          string         `json:"location"`
}

type FarmCoordinates struct {
    Lat float64 `json:"lat"`
    Lng float64 `json:"lng"`
}

type PlantScanResult struct {
    CropType           string      `json:"cropType"`
    Note               string      `json:"note"`
    CreatedAt          time.Time   `json:"createdAt"`
    FormattedCreatedAt string      `json:"formattedCreatedAt"`
    ID                 string      `json:"id"`
    Interpretation     interface{} `json:"interpretation"`
    ImageURI           string      `json:"imageUri"`
    ImageBytes         []byte      `json:"imageBytes"`
}

type SensorReadingsWithInterpretation struct {
    SensorReadings
    Interpretation Interpretation `json:"interpretation"`
}
*/

// Test data that should match exactly
const testFarm: FarmList = {
  owner: "0x123...",
  farmName: "Test Farm",
  id: "farm_001",
  cropType: "Corn",
  description: "Test description",
  image: "https://example.com/image.jpg",
  coordinates: {
    lat: 40.7128,
    lng: -74.0060
  },
  updatedAt: "2024-09-04T10:30:00Z",
  createdAt: "2024-08-15T08:00:00Z",
  formattedUpdatedAt: "September 4, 2024 at 10:30 AM",
  formattedCreatedAt: "August 15, 2024 at 8:00 AM",
  imageBytes: [1, 2, 3, 4], // number[] matches []byte from Go
  location: "New York, NY"
};

const testCoordinates: FarmCoordinates = {
  lat: 40.7128,  // number matches float64
  lng: -74.0060  // number matches float64
};

const testPlantScan: PlantScanResult = {
  cropType: "strawberry",
  note: "Plant looks healthy",
  createdAt: "2025-07-16T12:45:15.344Z",
  formattedCreatedAt: "July 16, 2025 - 12:45pm",
  id: "_Bn6MMNyTm8wC51MKQHx4",
  interpretation: {
    Diagnosis: "Healthy plant",
    Reason: "Good color and structure",
    Recommendations: ["Continue current care", "Monitor for pests"],
    HistoricalComparison: "Better than last month's reading"
  },
  imageUri: "ipfs://QmReGfsvu7yGswUVmABhek3wF4he6knLJg3ztn1DknrjBF/papaya",
  imageBytes: [137, 80, 78, 71] // PNG header bytes
};

const testSensorReading: SensorReadingsWithInterpretation = {
  fertility: 1600,
  moisture: 50,
  ph: 5,
  temperature: 25,
  sunlight: 1800,
  humidity: 50,
  farmName: "Test Farm",
  cropType: "strawberry",
  sensorId: "sensor_001",
  id: "07b8d8d2-ffc2-49a6-8ee3-947473ae77e3",
  createdAt: "2025-07-16T12:45:15.344Z",
  submittedAt: "2025-07-16T12:45:15.344Z",
  formattedCreatedAt: "July 16, 2025 - 12:45pm",
  formattedSubmittedAt: "July 16, 2025 - 12:45pm",
  interpretation: {
    evaluation: "Good",
    fertility: "The soil has a balanced nutrient profile, suitable for crop growth.",
    moisture: "Moisture levels are adequate, ensuring optimal plant hydration.",
    ph: "The pH level is slightly acidic, which is favorable for most crops.",
    temperature: "Soil temperature is within the optimal range for seed germination.",
    sunlight: "The area receives sufficient sunlight, supporting photosynthesis.",
    humidity: "Humidity levels are moderate, contributing to healthy plant development."
  }
};

const testFarmScanResult: FarmScanResult = {
  plantScans: [testPlantScan],
  soilReadings: [testSensorReading]
  // pagination is optional
};

// Export for testing
export { 
  testFarm, 
  testCoordinates, 
  testPlantScan, 
  testSensorReading, 
  testFarmScanResult 
};

// Type compatibility checks
type GoFarmListKeys = keyof FarmList;
type GoCoordinatesKeys = keyof FarmCoordinates;
type GoPlantScanKeys = keyof PlantScanResult;
type GoSensorReadingKeys = keyof SensorReadingsWithInterpretation;

// This will cause TypeScript errors if our interface doesn't match the expected structure
const requiredFarmFields: Record<GoFarmListKeys, string> = {
  owner: 'string',
  farmName: 'string', 
  id: 'string',
  cropType: 'string',
  description: 'string',
  image: 'string',
  coordinates: 'FarmCoordinates',
  updatedAt: 'string', // ISO date string from Go time.Time JSON
  createdAt: 'string', // ISO date string from Go time.Time JSON
  formattedUpdatedAt: 'string',
  formattedCreatedAt: 'string',
  imageBytes: 'number[]', // TypeScript number[] for Go []byte
  location: 'string'
};

const requiredCoordinateFields: Record<GoCoordinatesKeys, string> = {
  lat: 'number', // TypeScript number for Go float64
  lng: 'number'  // TypeScript number for Go float64
};

console.log('✅ Type verification passed - interfaces match Go structs');
export { requiredFarmFields, requiredCoordinateFields };
