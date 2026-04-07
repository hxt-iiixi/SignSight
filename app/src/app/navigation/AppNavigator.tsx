import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthScreen from "../../features/auth/screens/AuthScreen";
import DashboardHomeScreen from "../../features/dashboard/screens/DashboardHomeScreen";
import LabDeveloperScreen from "../../features/lab/screens/LabDeveloperScreen";
import SettingsRootScreen from "../../features/settings/screens/SettingsRootScreen";
import TranslatorScreen from "../../features/translator/screens/TranslatorScreen";
import FeedbackScreen from "../../screens/FeedbackScreen";
import TutorialScreen from "../../screens/TutorialScreen";
import VideoSplashScreen from "../../screens/VideoSplashScreen";

const RootStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;

  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          height: 72 + bottomNavPadding,
          paddingBottom: bottomNavPadding,
          paddingTop: 10,
        },
        tabBarActiveTintColor: "#E66E19",
        tabBarInactiveTintColor: "#737373",
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "HomeTab"
              ? "home-outline"
              : route.name === "TutorialTab"
                ? "book-outline"
                : route.name === "FeedbackTab"
                  ? "create-outline"
                  : "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardHomeScreen}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="TutorialTab"
        component={TutorialScreen}
        options={{ title: "Tutorial" }}
      />
      <Tab.Screen
        name="FeedbackTab"
        component={FeedbackScreen}
        options={{ title: "Feedback" }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsRootScreen}
        options={{ title: "Settings" }}
      />
    </Tab.Navigator>
  );
}

function MainAppStack() {
  return (
    <AppStack.Navigator id="main-app-stack" screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={MainTabs} />
      <AppStack.Screen name="Translator" component={TranslatorScreen} />
      <AppStack.Screen name="Lab" component={LabDeveloperScreen} />
    </AppStack.Navigator>
  );
}

export default function AppNavigator({
  authenticated,
  authLoading,
  hasFace,
  hasFingerprint,
  onAuthenticate,
  onPreferredChange,
  onRouteChange,
  onSplashFinish,
  preferred,
  showSplash,
}: {
  authenticated: boolean;
  authLoading: boolean;
  hasFace: boolean;
  hasFingerprint: boolean;
  onAuthenticate: () => void;
  onPreferredChange: (value: "auto" | "face" | "fingerprint") => void;
  onRouteChange: (routeName: string) => void;
  onSplashFinish: () => void;
  preferred: "auto" | "face" | "fingerprint";
  showSplash: boolean;
}) {
  return (
    <NavigationContainer
      onReady={() =>
        onRouteChange(showSplash ? "Splash" : authenticated ? "Main" : "Auth")
      }
      onStateChange={(state) => {
        const route = getActiveRouteName(state);
        if (route) {
          onRouteChange(route);
        }
      }}
    >
      <RootStack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
        {showSplash ? (
          <RootStack.Screen name="Splash">
            {() => <VideoSplashScreen onFinish={onSplashFinish} />}
          </RootStack.Screen>
        ) : null}
        {!showSplash && !authenticated ? (
          <RootStack.Screen name="Auth">
            {() => (
              <AuthScreen
                hasFace={hasFace}
                hasFingerprint={hasFingerprint}
                loading={authLoading}
                preferred={preferred}
                onAuthenticate={onAuthenticate}
                onPreferredChange={onPreferredChange}
              />
            )}
          </RootStack.Screen>
        ) : null}
        {!showSplash && authenticated ? (
          <RootStack.Screen name="Main" component={MainAppStack} />
        ) : null}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function getActiveRouteName(state: any): string | null {
  if (!state?.routes?.length) return null;
  const route = state.routes[state.index ?? 0];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name ?? null;
}
