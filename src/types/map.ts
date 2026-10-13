export type MapLocationType = 'market' | 'night_market' | 'alley' | 'other';

export interface MapLocation {
  location_id: string;
  name: string;
  type: MapLocationType;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  coordinate_source: 'demo' | 'reference' | 'manual';
  source_url?: string;
}

/** The image is not georeferenced. Floor positions use normalized image coordinates. */
export interface MarketFloorPlan {
  floor_plan_id: string;
  location_id: string;
  name: string;
  image_url: string;
  width: number;
  height: number;
  source_label: string;
  source_url?: string;
  is_demo: boolean;
}

export interface SensorPosition {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  observed_at: string;
}

export interface DevicePlacement {
  device_id: string;
  location_id: string;
  latitude: number | null;
  longitude: number | null;
  floor_plan_id: string | null;
  floor_x: number | null;
  floor_y: number | null;
  placement_note: string;
  sensor_position: SensorPosition | null;
}

export type DevicePlacementInput = Omit<DevicePlacement, 'sensor_position'>;

export interface MapState {
  locations: MapLocation[];
  floor_plans: MarketFloorPlan[];
  placements: DevicePlacement[];
}
