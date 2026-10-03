import type {
  Id,
  Pet,
  PetCreateRequest,
  PetsListResponse,
  PetUpdateRequest,
} from '../types';
import { request } from './client';

/** POST /pets — adds a pet to the signed-in owner. */
export function createPet(body: PetCreateRequest) {
  return request<Pet>('/pets', { method: 'POST', body, auth: true });
}

/** GET /pets — the signed-in owner's pets. */
export function listMyPets() {
  return request<PetsListResponse>('/pets', { auth: true });
}

/** GET /pets/{id} — public pet profile. */
export function getPet(id: Id) {
  return request<Pet>(`/pets/${encodeURIComponent(id)}`);
}

/** PATCH /pets/{id} — only the owner may update. */
export function updatePet(id: Id, body: PetUpdateRequest) {
  return request<Pet>(`/pets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

/** DELETE /pets/{id} — only the owner may delete. */
export function deletePet(id: Id) {
  return request<void>(`/pets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}
