import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GoWalkScreen } from '../screens/GoWalkScreen';
import { MapScreen } from '../screens/MapScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import { WhereToGoScreen } from '../screens/WhereToGoScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabs() {
	return (
		<Tab.Navigator initialRouteName="Map">
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
