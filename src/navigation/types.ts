import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { GeoPoint, Id } from '../types';
import type { PlaceSpot } from '../utils/announcements';

// Route names and their params.
export type RootTabParamList = {
  Map: undefined;
  GoWalk: undefined;
  /**
   * The shared feed. `spot` opens it filtered by that walk spot (e.g. from the
   * spot's card on the map); the screen applies it once and clears the param.
   */
  Feed: { spot?: PlaceSpot } | undefined;
  WhereToGo: undefined;
  Services: undefined;
};

/**
 * Root native stack. Which routes exist depends on the session (see RootNavigator):
 * signed out — Login, Register; signed in without pets — AddPet, OnboardingPets;
 * signed in — Tabs (+ AddPet, the walk announcement and post screens), and screens pushed
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
  /** New feed post: text, photos, the current place tag. */
  CreatePost: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Props of a tab screen that also navigates the root stack. */
export type RootTabScreenProps<T extends keyof RootTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<RootTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;
