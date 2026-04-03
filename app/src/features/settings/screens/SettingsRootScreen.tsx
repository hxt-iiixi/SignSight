import React from "react";
import { useNavigation } from "@react-navigation/native";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import SettingsScreen from "../../../screens/SettingsScreen";

export default function SettingsRootScreen() {
  const navigation = useNavigation<any>();
  const {
    debugEnabled,
    setDebugEnabled,
    showHandOverlay,
    setShowHandOverlay,
  } = useAppSettings();

  return (
    <SettingsScreen
      onBack={() => navigation.goBack()}
      debugEnabled={debugEnabled}
      setDebugEnabled={setDebugEnabled}
      showHandOverlay={showHandOverlay}
      setShowHandOverlay={setShowHandOverlay}
      onOpenLab={() => navigation.navigate("Lab")}
    />
  );
}
