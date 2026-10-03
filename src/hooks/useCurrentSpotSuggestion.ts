import { useEffect, useMemo, useState } from 'react';

import { listNearbyWalkSpots } from '../api';
import { useAuthStore } from '../store/authStore';
import { useFeedStore } from '../store/feedStore';
import { useLocationStore } from '../store/locationStore';
import { activeCheckIn, useWalkSpotsStore } from '../store/walkSpotsStore';
import type { Id } from '../types';
import type { PlaceSpot } from '../utils/announcements';

/** Why a place is suggested: a check-in made here, or the closest spot within 500 m. */
export type SpotSuggestionReason = 'checkIn' | 'nearby';

export interface SpotSuggestion {
  spot: PlaceSpot;
  reason: SpotSuggestionReason;
}

export interface CurrentSpotSuggestion {
  /** The place the user is most likely at now; null — no idea. */
  suggestion: SpotSuggestion | null;
  /** Still working it out (e.g. waiting for the position). */
  pending: boolean;
}

/**
 * Where the owner is now, for tagging a post: the spot where `petId` (or else
 * any of the owner's pets) is checked in from this device, otherwise the
 * closest walk spot within 500 m of the device position, otherwise none.
 * Never shows the location prompt: the position is used only when access was
 * granted before (or is granted through the form's explicit flow).
 */
export function useCurrentSpotSuggestion(
  petId: Id | null,
): CurrentSpotSuggestion {
  const pets = useAuthStore(state => state.pets);
  const myCheckIns = useWalkSpotsStore(state => state.myCheckIns);
  const resolveSpot = useFeedStore(state => state.resolveSpot);
  const permission = useLocationStore(state => state.permission);
  const locating = useLocationStore(state => state.locating);
  const userPosition = useLocationStore(state => state.userPosition);
  const checkPermission = useLocationStore(state => state.checkPermission);

  const [result, setResult] = useState<CurrentSpotSuggestion>({
    suggestion: null,
    pending: true,
  });

  // Locates the user when access was granted before (never prompts).
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const checkInSpotId = useMemo(() => {
    const ids = pets.map(pet => pet.id);
    const ordered = petId ? [petId, ...ids.filter(id => id !== petId)] : ids;
    for (const id of ordered) {
      const entry = activeCheckIn(myCheckIns, id);
      if (entry) {
        return entry.spot_id;
      }
    }
    return null;
  }, [petId, pets, myCheckIns]);

  const lat = userPosition?.lat;
  const lng = userPosition?.lng;
  const waitingForPosition =
    permission === 'unknown' || (permission === 'granted' && locating);

  useEffect(() => {
    let current = true;

    async function suggest(): Promise<SpotSuggestion | null | 'wait'> {
      if (checkInSpotId) {
        // The map's markers usually know the spot already.
        const marker = useWalkSpotsStore
          .getState()
          .spots.find(spot => spot.id === checkInSpotId);
        const info =
          marker ?? (await resolveSpot(checkInSpotId).catch(() => null));
        if (info) {
          const { name, lat: spotLat, lng: spotLng } = info;
          return {
            spot: { id: checkInSpotId, name, lat: spotLat, lng: spotLng },
            reason: 'checkIn',
          };
        }
      }
      if (lat !== undefined && lng !== undefined) {
        const { spots } = await listNearbyWalkSpots({ lat, lng });
        const nearest = spots[0];
        return nearest
          ? {
              spot: {
                id: nearest.id,
                name: nearest.name,
                lat: nearest.lat,
                lng: nearest.lng,
                distance_m: nearest.distance_m,
              },
              reason: 'nearby',
            }
          : null;
      }
      return waitingForPosition ? 'wait' : null;
    }

    setResult(previous => ({ ...previous, pending: true }));
    suggest()
      .catch(() => null)
      .then(value => {
        if (!current) {
          return;
        }
        setResult(
          value === 'wait'
            ? { suggestion: null, pending: true }
            : { suggestion: value, pending: false },
        );
      });
    return () => {
      current = false;
    };
  }, [checkInSpotId, lat, lng, waitingForPosition, resolveSpot]);

  return result;
}
