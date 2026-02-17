import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Linking } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { StoreProvider } from './src/contexts/StoreContext';
import { setCurrentStoreId, setCurrentUserId } from './src/services/api';
import { supabase } from './src/services/supabase';
import { initNetworkMonitoring } from './src/services/network';

// Disable native screens to fix "expected dynamic type 'boolean', but had type 'string'" error on Expo 52
enableScreens(false);

// import SaleScreen from './src/screens/SaleScreen';
import AIScreen from './src/screens/AIScreen';
import StockScreen from './src/screens/StockScreen';
import StockScanScreen from './src/screens/StockScanScreen';
import ScanScreen from './src/screens/ScanScreen';
import DebtScreen from './src/screens/DebtScreen';
import ReportScreen from './src/screens/ReportScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import AlertScreen from './src/screens/AlertScreen';
import TopBar from './src/components/TopBar';
import BottomNav from './src/components/BottomNav';
import BranchListScreen from './src/screens/BranchListScreen';
import BranchDetailScreen from './src/screens/BranchDetailScreen';
import DeviceConnectScreen from './src/screens/DeviceConnectScreen';
import BackupScreen from './src/screens/BackupScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';

import AllTransactionsScreen from './src/screens/AllTransactionsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs({ onLogout, onGoToBranchList }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      <Tab.Navigator
        screenOptions={{
          header: () => <TopBar onLogout={onLogout} onGoToBranchList={onGoToBranchList} />,
          freezeOnBlur: false,
        }}
        tabBar={({ state, descriptors, navigation }) => {
          const activeRouteName = state.routes[state.index].name;
          return (
            <BottomNav
              activeTab={activeRouteName}
              onTabPress={(name) => navigation.navigate(name)}
            />
          );
        }}
        detachInactiveScreens={false}
      >
        <Tab.Screen name="ผู้ช่วย" component={AIScreen} />
        <Tab.Screen name="คลัง" component={StockScreen} />
        <Tab.Screen name="สแกน" component={ScanScreen} />
        <Tab.Screen name="ค้างชำระ" component={DebtScreen} />
        <Tab.Screen name="รายงาน" component={ReportScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

function MainStack({ onLogout, onGoToBranchList }) {
  return (
    <Stack.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        ...TransitionPresets.SlideFromRightIOS,
      }}
    >
      <Stack.Screen name="MainTabs">
        {() => <MainTabs onLogout={onLogout} onGoToBranchList={onGoToBranchList} />}
      </Stack.Screen>
      <Stack.Screen
        name="StockScan"
        component={StockScanScreen}
        options={{
          presentation: 'card',
          cardStyle: { backgroundColor: 'black' },
          cardOverlayEnabled: false,
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="Alert"
        component={AlertScreen}
        options={{
          cardStyle: { backgroundColor: '#fff' },
          cardOverlayEnabled: true,
        }}
      />
      <Stack.Screen name="DeviceConnect" component={DeviceConnectScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('SignIn');
  const [authData, setAuthData] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Auth screen navigation handler
  const navigateTo = (screen) => {
    setCurrentScreen(screen);
  };

  // Handle Deep Linking
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event.url;
      if (!url) return;

      // Extract fragment (hash) or query params
      // Supabase Implicit Flow puts tokens in the hash (#access_token=...)
      // But sometimes configured for query params (?access_token=...)
      // We'll check both.

      const extractParam = (paramName) => {
        const regex = new RegExp(`[#?&]${paramName}=([^&]+)`);
        const match = url.match(regex);
        return match ? decodeURIComponent(match[1]) : null;
      };

      const accessToken = extractParam('access_token');
      const refreshToken = extractParam('refresh_token');
      const type = extractParam('type');

      if (accessToken && refreshToken) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
          
          // If it's a recovery link, the auth state change listener will pick it up
          if (type === 'recovery') {
            setCurrentScreen('ResetPassword');
          }
        } catch (e) {
          console.log('Deep link session error (ignored):', e.message);
          // Alert.alert('Error', 'Invalid or expired link'); 
        }
      }
    };

    // 1. Listen for incoming links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 2. Check if app was opened via a link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Listen for Supabase Auth State Changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        const storedAuth = await AsyncStorage.getItem('authData');
        if (!storedAuth) {
          setCurrentScreen('ResetPassword');
        }
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setAuthData(null);
        setSelectedBranch(null);
        setCurrentScreen('SignIn');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  // Restore session & Init Network
  useEffect(() => {
    // Start Network Monitoring
    const unsubscribeNetwork = initNetworkMonitoring();

    const checkAuth = async () => {
      try {
        const storedAuth = await AsyncStorage.getItem('authData');
        if (storedAuth) {
          const data = JSON.parse(storedAuth);
          setAuthData(data);
          setCurrentUserId(data.user.id);

          if (data.profile.role === 'owner') {
            setCurrentScreen('BranchList');
          } else {
            if (data.stores.length > 0) {
              const savedStoreId = await AsyncStorage.getItem('currentStoreId');
              const targetStore = data.stores.find(s => s.id === savedStoreId) || data.stores[0];
              setSelectedBranch(targetStore);
              setCurrentStoreId(targetStore.id);
              setIsLoggedIn(true);
            }
          }
        }
      } catch (e) {
        console.error('Failed to restore auth', e);
      }
    };
    checkAuth();

    return () => {
      unsubscribeNetwork();
    };
  }, []);

  const handleLogin = (data) => {
    setAuthData(data);
    setCurrentUserId(data.user.id);

    // Owner: ไปหน้า BranchList (รวมสาขา)
    if (data.profile.role === 'owner') {
      setCurrentScreen('BranchList');
    }
    // Manager: เข้า POS โดยตรง
    else {
      if (data.stores.length === 0) {
        Alert.alert('ข้อผิดพลาด', 'คุณยังไม่ได้รับสิทธิ์เข้าถึงร้านใดๆ');
        return;
      }
      setSelectedBranch(data.stores[0]);
      setCurrentStoreId(data.stores[0].id);
      setIsLoggedIn(true);
      AsyncStorage.setItem('currentStoreId', data.stores[0].id);
    }
    // Persist login
    AsyncStorage.setItem('authData', JSON.stringify(data));
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setCurrentStoreId(branch.id); // Set store_id for API calls
    setCurrentScreen('BranchDetail');
  };

  const handleEnterPOS = (branch) => {
    setSelectedBranch(branch);
    setCurrentStoreId(branch.id);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('authData');
    await AsyncStorage.removeItem('currentStoreId');
    setIsLoggedIn(false);
    setCurrentScreen('SignIn');
    setAuthData(null);
    setSelectedBranch(null);
  };

  const handleBackToBranchList = () => {
    setSelectedBranch(null);
    setCurrentScreen('BranchList');
  };

  const handleGoToBranchList = () => {
    setIsLoggedIn(false);
    setCurrentScreen('BranchList');
  };

  // Show auth screens if not logged in
  const renderContent = () => {
    if (!isLoggedIn) {
      if (currentScreen === 'SignIn') {
        return (
          <>
            <SignInScreen
              onLogin={handleLogin}
              onNavigateToSignUp={() => navigateTo('SignUp')}
              onNavigateToForgotPassword={() => navigateTo('ForgotPassword')}
            />
            <StatusBar style="light" />
          </>
        );
      } else if (currentScreen === 'SignUp') {
        return (
          <>
            <SignUpScreen
              onSignUp={() => navigateTo('SignIn')}
              onNavigateToSignIn={() => navigateTo('SignIn')}
            />
            <StatusBar style="light" />
          </>
        );
      } else if (currentScreen === 'ForgotPassword') {
        return (
          <>
            <ForgotPasswordScreen
              onNavigateToSignIn={() => navigateTo('SignIn')}
            />
            <StatusBar style="light" />
          </>
        );
      } else if (currentScreen === 'ResetPassword') {
        return (
          <>
            <ResetPasswordScreen
              onNavigateToSignIn={() => navigateTo('SignIn')}
            />
            <StatusBar style="light" />
          </>
        );
      } else if (currentScreen === 'BranchList') {
        return (
          <>
            <BranchListScreen
              userProfile={authData?.profile}
              onSelectBranch={handleBranchSelect}
              onLogout={handleLogout}
            />
            <StatusBar style="light" />
          </>
        );
      } else if (currentScreen === 'BranchDetail') {
        return (
          <>
            <BranchDetailScreen
              branch={selectedBranch}
              onBack={handleBackToBranchList}
              onEnterPOS={handleEnterPOS}
            />
            <StatusBar style="light" />
          </>
        );
      }
    }

    return (
      <NavigationContainer>
        <MainStack onLogout={handleLogout} onGoToBranchList={handleGoToBranchList} />
        <StatusBar style="dark" />
      </NavigationContainer>
    );
  };

  // Main app wrap
  return (
    <SafeAreaProvider>
      <StoreProvider profile={authData?.profile} store={selectedBranch}>
        {renderContent()}
      </StoreProvider>
    </SafeAreaProvider>
  );
}
