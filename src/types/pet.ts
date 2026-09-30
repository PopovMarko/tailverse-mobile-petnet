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

/** PATCH /pets/{id} — absent fields are left unchanged. */
export type PetUpdateRequest = Partial<PetCreateRequest>;

/** GET /pets */
export interface PetsListResponse {
  pets: Pet[];
}
