import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
 * signed in — Tabs (+ AddPet), and screens pushed over the tabs by later stages.
 */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  AddPet: undefined;
  OnboardingPets: undefined;
  Tabs: NavigatorScreenParams<RootTabParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
