export interface PSGCCity {
  code: string;
  name: string;
}

export interface PSGCProvince {
  code: string;
  name: string;
  municipalities: PSGCCity[];
}

export interface PSGCRegion {
  code: string;
  name: string;
  provinces?: PSGCProvince[];
  municipalities?: PSGCCity[]; // for NCR (no provinces, direct cities/municipalities)
}

// Import the complete Philippine data
import phData from './ph.json';

// Region name mapping for better display
const REGION_NAMES: Record<string, string> = {
  '01': 'Region I - Ilocos Region',
  '02': 'Region II - Cagayan Valley',
  '03': 'Region III - Central Luzon',
  '4A': 'Region IV-A - CALABARZON',
  '4B': 'Region IV-B - MIMAROPA',
  '05': 'Region V - Bicol Region',
  '06': 'Region VI - Western Visayas',
  '07': 'Region VII - Central Visayas',
  '08': 'Region VIII - Eastern Visayas',
  '09': 'Region IX - Zamboanga Peninsula',
  '10': 'Region X - Northern Mindanao',
  '11': 'Region XI - Davao Region',
  '12': 'Region XII - SOCCSKSARGEN',
  '13': 'Region XIII - Caraga',
  'NCR': 'NCR - National Capital Region',
  'CAR': 'CAR - Cordillera Administrative Region',
  'BARMM': 'BARMM - Bangsamoro'
};

// Cache for parsed regions
let PSGC_REGIONS_CACHE: PSGCRegion[] | null = null;

// Helper to title case names
const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\(pob\.\)/gi, '(Pob.)')
    .replace(/\bii\b/gi, 'II')
    .replace(/\biii\b/gi, 'III')
    .replace(/\biv\b/gi, 'IV');
};

export const loadFullPSGC = (): PSGCRegion[] => {
  if (PSGC_REGIONS_CACHE) return PSGC_REGIONS_CACHE;

  const data = phData as Record<string, { region_name: string; province_list: Record<string, { municipality_list: Record<string, { barangay_list: string[] }> }> }>;
  
  const regions: PSGCRegion[] = Object.entries(data).map(([code, regionData]) => {
    const regionName = REGION_NAMES[code] || regionData.region_name;
    
    // For NCR, provinces are actually cities/municipalities directly
    if (code === 'NCR') {
      const municipalities: PSGCCity[] = Object.keys(regionData.province_list).map((cityName, idx) => ({
        code: `NCR-${idx + 1}`,
        name: toTitleCase(cityName)
      }));
      
      return {
        code,
        name: regionName,
        municipalities
      };
    }
    
    // For other regions, process provinces and municipalities
    const provinces: PSGCProvince[] = Object.entries(regionData.province_list).map(([provinceName, provinceData], pIdx) => {
      const municipalities: PSGCCity[] = Object.keys(provinceData.municipality_list).map((munName, mIdx) => ({
        code: `${code}-${pIdx + 1}-${mIdx + 1}`,
        name: toTitleCase(munName)
      }));
      
      return {
        code: `${code}-${pIdx + 1}`,
        name: toTitleCase(provinceName),
        municipalities
      };
    });
    
    return {
      code,
      name: regionName,
      provinces
    };
  });

  // Sort regions by a logical order
  const regionOrder: string[] = ['NCR', 'CAR', '01', '02', '03', '4A', '4B', '05', '06', '07', '08', '09', '10', '11', '12', '13', 'BARMM'];
  regions.sort((a, b) => {
    const aIdx = regionOrder.indexOf(a.code);
    const bIdx = regionOrder.indexOf(b.code);
    return aIdx - bIdx;
  });

  PSGC_REGIONS_CACHE = regions;
  return PSGC_REGIONS_CACHE;
};

export const findRegion = (codeOrName: string): PSGCRegion | undefined => {
  const regions = loadFullPSGC();
  return regions.find(r => r.code === codeOrName || r.name === codeOrName);
};

export const listRegions = (): PSGCRegion[] => loadFullPSGC();
