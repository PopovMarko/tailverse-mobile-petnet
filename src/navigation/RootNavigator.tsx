import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LogoutButton } from '../components/LogoutButton';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { AddPetScreen } from '../screens/pets/AddPetScreen';
import { OnboardingPetsScreen } from '../screens/pets/OnboardingPetsScreen';
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
          {/* Screens pushed over the tabs (pet/owner profiles, …) go here. */}
          <Stack.Screen
            name="AddPet"
            component={AddPetScreen}
            options={{ title: 'Новый питомец' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
