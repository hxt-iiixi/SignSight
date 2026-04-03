import React from "react";
import { useNavigation } from "@react-navigation/native";

import DashboardScreen from "../../../screens/DashboardScreen";

export default function DashboardHomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <DashboardScreen
      onTranslate={() => navigation.navigate("Translator")}
    />
  );
}
