import type { Id, Timestamp } from './common';

export interface Service {
  id: Id;
  provider_owner_id: Id;
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  price: number;
  created_at: Timestamp;
}

/** POST /services */
export interface ServiceCreateRequest {
  title: string;
  description?: string;
  category: string;
  lat: number;
  lng: number;
  price?: number;
}

/** GET /services */
export interface ServicesListResponse {
  services: Service[];
}
