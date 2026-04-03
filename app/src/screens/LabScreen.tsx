import React from "react";

import CameraExperience, { type CameraExperienceProps } from "../components/camera/CameraExperience";

type LabScreenProps = Omit<CameraExperienceProps, "variant">;

export default function LabScreen(props: LabScreenProps) {
  return <CameraExperience {...props} variant="lab" />;
}
