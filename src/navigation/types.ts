import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { GeoPoint, Id } from '../types';
import type { PlaceSpot } from '../utils/announcements';

// Route names and their params. No tab takes params yet.
export type RootTabParamList = {
  Map: undefined;
  GoWalk: undefined;
  WhereToGo: undefined;
  Services: undefined;
};

/**
 * Root native stack. Which routes exist depends on the session (see RootNavigator):
 * signed out — Login, Register; signed in without pets — AddPet, OnboardingPets;
 * signed in — Tabs (+ AddPet, the walk announcement screens), and screens pushed
 * over the tabs by later stages.
 */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  AddPet: undefined;
  OnboardingPets: undefined;
  Tabs: NavigatorScreenParams<RootTabParamList>;
  /**
   * "Иду гулять" form. `spot` preselects a walk spot (e.g. from a spot's card);
   * `pickedPoint` is how PickWalkPoint hands back the point chosen on the map.
   */
  CreateAnnouncement: { spot?: PlaceSpot; pickedPoint?: GeoPoint } | undefined;
  /** Map for choosing the walk's point; returns it to CreateAnnouncement. */
  PickWalkPoint: { initial?: GeoPoint } | undefined;
  /** A walk with its participants; join/leave. */
  AnnouncementDetails: { id: Id };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Props of a tab screen that also navigates the root stack. */
export type RootTabScreenProps<T extends keyof RootTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<RootTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;
