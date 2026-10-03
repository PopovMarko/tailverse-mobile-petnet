import type { DateString, Id, Timestamp } from './common';

export interface Pet {
  id: Id;
  owner_id: Id;
  name: string;
  breed: string;
  species: string;
  birth_date: DateString | null;
  age: number | null;
  approx_address: string;
  created_at: Timestamp;
}

/** POST /pets */
export interface PetCreateRequest {
  name: string;
  breed: string;
  species?: string;
  birth_date?: DateString | null;
  approx_address: string;
}

/**
 * PATCH /pets/{id} — absent (or null) fields are left unchanged; birth_date ""
 * removes the birth date. name, breed and approx_address can't be blank.
 */
export interface PetUpdateRequest {
  name?: string;
  breed?: string;
  species?: string;
  birth_date?: DateString | '' | null;
  approx_address?: string;
}

/** GET /pets */
export interface PetsListResponse {
  pets: Pet[];
}
