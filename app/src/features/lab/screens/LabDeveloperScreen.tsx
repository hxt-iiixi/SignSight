import React, { useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import LabScreen from "../../../screens/LabScreen";
import { CaptureCard } from "../components/CaptureCard";

type LabTabParamList = {
  CaptureTab: undefined;
  DatasetTab: undefined;
  ModelsTab: undefined;
  MetricsTab: undefined;
};

const Tab = createBottomTabNavigator<LabTabParamList>();

function CaptureTabScreen() {
  const navigation = useNavigation<any>();
  const { debugEnabled, showHandOverlay } = useAppSettings();

  return (
    <LabScreen
      onBack={() => navigation.goBack()}
      debugEnabled={debugEnabled}
      showHandOverlay={showHandOverlay}
    />
  );
}

function LabTabContentScreen() {
  const navigation = useNavigation<any>();
  const { debugEnabled, showHandOverlay } = useAppSettings();

  return (
    <LabScreen
      onBack={() => navigation.goBack()}
      debugEnabled={debugEnabled}
      showHandOverlay={showHandOverlay}
    />
  );
}

function getLabTabIcon(routeName: keyof LabTabParamList) {
  if (routeName === "CaptureTab") return "camera-outline" as const;
  if (routeName === "DatasetTab") return "albums-outline" as const;
  if (routeName === "ModelsTab") return "cube-outline" as const;
  return "stats-chart-outline" as const;
}

export default function LabDeveloperScreen() {
  const [activeTab, setActiveTab] = useState<keyof LabTabParamList>("CaptureTab");
  const bottomNavPadding = Platform.OS === "android" ? 44 : 22;

  return (
    <View style={styles.container}>
      <Tab.Navigator
        id="lab-tabs"
        screenOptions={({ route }) => ({
          headerShown: false,
        tabBarStyle: {
          height: 72 + bottomNavPadding,
          paddingBottom: bottomNavPadding,
          paddingTop: 10,
          borderTopWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
          tabBarActiveTintColor: "#E66E19",
          tabBarInactiveTintColor: "#737373",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={getLabTabIcon(route.name as keyof LabTabParamList)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen
          name="CaptureTab"
          component={CaptureTabScreen}
          listeners={{ focus: () => setActiveTab("CaptureTab") }}
          options={{ title: "Capture" }}
        />
        <Tab.Screen
          name="DatasetTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("DatasetTab") }}
          options={{ title: "Dataset" }}
        />
        <Tab.Screen
          name="ModelsTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("ModelsTab") }}
          options={{ title: "Models" }}
        />
        <Tab.Screen
          name="MetricsTab"
          component={LabTabContentScreen}
          listeners={{ focus: () => setActiveTab("MetricsTab") }}
          options={{ title: "Metrics" }}
        />
      </Tab.Navigator>

      {activeTab === "CaptureTab" ? <CaptureCard /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
