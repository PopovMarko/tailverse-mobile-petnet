import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ProfileButton } from '../components/ProfileButton';
import { FeedScreen } from '../screens/FeedScreen';
import { GoWalkScreen } from '../screens/GoWalkScreen';
import { MapScreen } from '../screens/MapScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import { WhereToGoScreen } from '../screens/WhereToGoScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

// The owner's avatar in every tab's header opens the profile (and "log out").
const profileButton = () => <ProfileButton />;

export function RootTabs() {
	return (
		<Tab.Navigator
			initialRouteName="Map"
			screenOptions={{ headerRight: profileButton }}
		>
			<Tab.Screen
				name="Map"
				component={MapScreen}
				options={{ title: 'Карта' }}
			/>
			<Tab.Screen
				name="GoWalk"
				component={GoWalkScreen}
				options={{ title: 'Иду гулять' }}
			/>
			<Tab.Screen
				name="Feed"
				component={FeedScreen}
				options={{ title: 'Лента' }}
			/>
			<Tab.Screen
				name="WhereToGo"
				component={WhereToGoScreen}
				options={{ title: 'Куда пойти' }}
			/>
			<Tab.Screen
				name="Services"
				component={ServicesScreen}
				options={{ title: 'Услуги' }}
			/>
		</Tab.Navigator>
	);
}
