import React from "react";

import CameraExperience, { type CameraExperienceProps } from "../components/camera/CameraExperience";

type CameraScreenVCProps = CameraExperienceProps;

export default function CameraScreenVC(props: CameraScreenVCProps) {
  return <CameraExperience {...props} />;
}
