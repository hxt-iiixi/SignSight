import React, { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as NavigationBar from "expo-navigation-bar";

import AppNavigator from "./navigation/AppNavigator";
import { AppSettingsProvider } from "./providers/AppSettingsProvider";

export default function AppShell() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [supportedTypes, setSupportedTypes] = useState<number[]>([]);
  const [preferred, setPreferred] = useState<"auto" | "face" | "fingerprint">("auto");
  const [currentRouteName, setCurrentRouteName] = useState("Splash");

  const hasFace = useMemo(
    () => supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
    [supportedTypes]
  );
  const hasFingerprint = useMemo(
    () => supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
    [supportedTypes]
  );

  const isCameraLikeRoute =
    currentRouteName === "Translator" || currentRouteName === "Lab";
  const statusBarStyle =
    showSplash || loading || !authenticated || isCameraLikeRoute
      ? "light"
      : "dark";
  const statusBarBackgroundColor =
    showSplash || loading || !authenticated
      ? "#000000"
      : isCameraLikeRoute
        ? "transparent"
        : "#FFFFFF";
  const statusBarTranslucent = isCameraLikeRoute;

  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        try {
          await NavigationBar.setBackgroundColorAsync("#FFFFFF");
          await NavigationBar.setButtonStyleAsync("dark");
        } catch {}
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setSupportedTypes(types || []);
    })();
  }, []);

  useEffect(() => {
    if (!showSplash) {
      void authenticate();
    }
  }, [showSplash, preferred]);

  const authenticate = async () => {
    try {
      setLoading(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setAuthenticated(true);
        setCurrentRouteName("Main");
        return;
      }

      const prompt =
        preferred === "face"
          ? "Unlock with Face"
          : preferred === "fingerprint"
            ? "Unlock with Fingerprint"
            : hasFace
              ? "Unlock with Face"
              : "Unlock";

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        disableDeviceFallback: false,
        fallbackLabel: "Use device passcode",
      });

      setAuthenticated(result.success);
      setCurrentRouteName(result.success ? "Main" : "Auth");
    } catch {
      setAuthenticated(false);
      setCurrentRouteName("Auth");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppSettingsProvider>
      <ExpoStatusBar
        style={statusBarStyle}
        backgroundColor={statusBarBackgroundColor}
        translucent={statusBarTranslucent}
      />
      <AppNavigator
        authenticated={authenticated}
        authLoading={loading}
        hasFace={hasFace}
        hasFingerprint={hasFingerprint}
        onAuthenticate={authenticate}
        onPreferredChange={setPreferred}
        onRouteChange={setCurrentRouteName}
        onSplashFinish={() => setShowSplash(false)}
        preferred={preferred}
        showSplash={showSplash}
      />
    </AppSettingsProvider>
  );
}
