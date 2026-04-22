import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SplashScreen from './src/mobile/screens/SplashScreen';
import LoginScreen from './src/mobile/screens/LoginScreen';
import SignUpScreen from './src/mobile/screens/SignUpScreen';
import BranchSelectionScreen from './src/mobile/screens/BranchSelectionScreen';
import DashboardScreen from './src/mobile/screens/DashboardScreen';
import NewDossierScreen from './src/mobile/screens/NewDossierScreen';
import DocumentCaptureScreen from './src/mobile/screens/DocumentCaptureScreen';
import OCRResultScreen from './src/mobile/screens/OCRResultScreen';
import ResearchHubScreen from './src/mobile/screens/ResearchHubScreen';
import UniversalSearchScreen from './src/mobile/screens/UniversalSearchScreen';
import BatchSearchScreen from './src/mobile/screens/BatchSearchScreen';
import WatchlistScreen from './src/mobile/screens/WatchlistScreen';
import IntelligenceReportScreen from './src/mobile/screens/IntelligenceReportScreen';
import TimelineScreen from './src/mobile/screens/TimelineScreen';
import ScoringScreen from './src/mobile/screens/ScoringScreen';
import ExceptionScreens from './src/mobile/screens/ExceptionScreens';
import PlaceholderScreen from './src/mobile/screens/PlaceholderScreen';
import IdentityVerificationScreen from './src/mobile/screens/IdentityVerificationScreen';
import ValidationFinalScreen from './src/mobile/screens/ValidationFinalScreen';
import InvestigationToolsScreen from './src/mobile/screens/InvestigationToolsScreen';
import SettingsScreen from './src/mobile/screens/SettingsScreen';
import ArchivageScreen from './src/mobile/screens/ArchivageScreen';

import { AuthProvider, useAuth } from './src/shared/services/AuthContext';
import { theme } from './src/shared/theme/theme';
import { canRoleAccess, AppScreen } from './src/shared/config/rolePermissions';
import { UserRole } from './src/shared/types';

const Stack = createNativeStackNavigator();

// Chaque entrée associe un nom d'écran à son composant.
// Le filtre par rôle se fait au moment du rendu via canRoleAccess.
const ALL_APP_SCREENS: { name: AppScreen; component: React.ComponentType<any> }[] = [
  { name: 'Dashboard',            component: DashboardScreen },
  { name: 'NewDossier',           component: NewDossierScreen },
  { name: 'DocumentCapture',      component: DocumentCaptureScreen },
  { name: 'OCRProcessing',        component: PlaceholderScreen },
  { name: 'OCRResult',            component: OCRResultScreen },
  { name: 'IdentityVerification', component: IdentityVerificationScreen },
  { name: 'ValidationFinale',     component: ValidationFinalScreen },
  { name: 'DossierBloque',        component: PlaceholderScreen },
  { name: 'Scoring',              component: ScoringScreen },
  { name: 'Exceptions',           component: ExceptionScreens },
  { name: 'ExceptionHandling',    component: ExceptionScreens },
  { name: 'EscaladeSuperieur',    component: PlaceholderScreen },
  { name: 'Timeline',             component: TimelineScreen },
  { name: 'ResearchHub',          component: ResearchHubScreen },
  { name: 'UniversalSearch',      component: UniversalSearchScreen },
  { name: 'SearchDetail',         component: PlaceholderScreen },
  { name: 'BatchSearch',          component: BatchSearchScreen },
  { name: 'Watchlists',           component: WatchlistScreen },
  { name: 'IntelligenceReport',   component: IntelligenceReportScreen },
  { name: 'InvestigationTools',   component: InvestigationToolsScreen },
  { name: 'Settings',             component: SettingsScreen },
  { name: 'Archivage',            component: ArchivageScreen },
];

function AppNavigator() {
  const { isAuthenticated, isLoading, selectedBranch, user } = useAuth();

  const role = (user?.role ?? 'conseiller') as UserRole;

  const allowedScreens = ALL_APP_SCREENS.filter(s => canRoleAccess(role, s.name));

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: Platform.OS === 'ios',
        }}
      >
        {isLoading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !isAuthenticated ? (
          <Stack.Group navigationKey="auth">
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </Stack.Group>
        ) : !selectedBranch && !['responsable', 'admin'].includes(role) ? (
          <Stack.Group navigationKey="branch-selection">
            <Stack.Screen name="BranchSelection" component={BranchSelectionScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey={`app-${role}`}>
            {allowedScreens.map(({ name, component }) => (
              <Stack.Screen key={name} name={name} component={component} />
            ))}
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
