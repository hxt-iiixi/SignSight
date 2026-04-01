import React from "react";

import CameraScreenVC from "./CameraScreenVC";

type LabScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  showHandOverlay: boolean;
};

export default function LabScreen({
  onBack,
  debugEnabled,
  showHandOverlay,
}: LabScreenProps) {
  return (
    <CameraScreenVC
      onBack={onBack}
      debugEnabled={debugEnabled}
      showHandOverlay={showHandOverlay}
      variant="lab"
    />
  );
}
