import React from "react";
import { useNavigation } from "@react-navigation/native";

import { useAppSettings } from "../../../app/providers/AppSettingsProvider";
import CameraScreenVC from "../../../screens/CameraScreenVC";

export default function TranslatorScreen() {
  const navigation = useNavigation<any>();
  const { debugEnabled, showHandOverlay } = useAppSettings();

  return (
    <CameraScreenVC
      onBack={() => navigation.goBack()}
      debugEnabled={debugEnabled}
      showHandOverlay={showHandOverlay}
    />
  );
}
