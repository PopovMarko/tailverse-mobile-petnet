import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LogoutButton } from '../components/LogoutButton';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { AnnouncementDetailsScreen } from '../screens/announcements/AnnouncementDetailsScreen';
import { CreateAnnouncementScreen } from '../screens/announcements/CreateAnnouncementScreen';
import { PickWalkPointScreen } from '../screens/announcements/PickWalkPointScreen';
import { CreatePostScreen } from '../screens/feed/CreatePostScreen';
import { AddPetScreen } from '../screens/pets/AddPetScreen';
import { EditPetScreen } from '../screens/pets/EditPetScreen';
import { OnboardingPetsScreen } from '../screens/pets/OnboardingPetsScreen';
import { PetProfileScreen } from '../screens/pets/PetProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useAuthStore } from '../store/authStore';
import { RootTabs } from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const logoutButton = () => <LogoutButton />;

/**
 * Picks the screens for the session state: auth screens until logged in, pet
 * onboarding until the owner has a pet, then the main tabs. Changing state
 * swaps the screen set, so there is no way "back" into the other flow.
 */
export function RootNavigator() {
  const status = useAuthStore(state => state.status);
  const needsOnboarding = useAuthStore(state => state.needsOnboarding);

  if (status === 'restoring') {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {status === 'signedOut' ? (
        <Stack.Group navigationKey="auth">
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Вход', headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Регистрация' }}
          />
        </Stack.Group>
      ) : needsOnboarding ? (
        <Stack.Group
          navigationKey="onboarding"
          screenOptions={{ headerRight: logoutButton }}
        >
          <Stack.Screen
            name="AddPet"
            component={AddPetScreen}
            options={{ title: 'Ваш питомец' }}
          />
          <Stack.Screen
            name="OnboardingPets"
            component={OnboardingPetsScreen}
            options={{ title: 'Ваши питомцы', headerBackVisible: false }}
          />
        </Stack.Group>
      ) : (
        <Stack.Group navigationKey="app">
          <Stack.Screen
            name="Tabs"
            component={RootTabs}
            options={{ headerShown: false }}
          />
          {/* Screens pushed over the tabs. */}
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Мой профиль' }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: 'Редактировать профиль' }}
          />
          <Stack.Screen
            name="PetProfile"
            component={PetProfileScreen}
            options={{ title: 'Питомец' }}
          />
          <Stack.Screen
            name="EditPet"
            component={EditPetScreen}
            options={{ title: 'Редактировать питомца' }}
          />
          <Stack.Screen
            name="AddPet"
            component={AddPetScreen}
            options={{ title: 'Новый питомец' }}
          />
          <Stack.Screen
            name="CreateAnnouncement"
            component={CreateAnnouncementScreen}
            options={{ title: 'Иду гулять' }}
          />
          <Stack.Screen
            name="PickWalkPoint"
            component={PickWalkPointScreen}
            options={{ title: 'Точка на карте' }}
          />
          <Stack.Screen
            name="AnnouncementDetails"
            component={AnnouncementDetailsScreen}
            options={{ title: 'Прогулка' }}
          />
          <Stack.Screen
            name="CreatePost"
            component={CreatePostScreen}
            options={{ title: 'Новый пост' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
