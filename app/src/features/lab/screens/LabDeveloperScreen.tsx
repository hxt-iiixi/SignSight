import React from "react";
import { useNavigation } from "@react-navigation/native";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import LabScreen from "../../../screens/LabScreen";

export default function LabDeveloperScreen() {
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
