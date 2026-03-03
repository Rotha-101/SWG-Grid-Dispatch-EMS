
export interface UnitData {
  id: string;
  name: string;
  badgeColor: string;
  activeMW: number;
  reacMVAR: number;
  soc: number;
  cRate: number;
  soh: number;
  pLimit: number;
  originalP: number;
  limitedP: number;
  enabled?: boolean;
}

export interface DispatchEntry {
  id: string;
  timestamp: string;
  units: Record<string, { active: number; reac: number; soc: number }>;
}

export interface SystemStatus {
  gridNominal: boolean;
  telemetryLink: boolean;
  stationAuthActive: boolean;
  coreVersion: string;
}
