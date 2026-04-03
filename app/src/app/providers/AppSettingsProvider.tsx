import React, { createContext, useContext, useMemo, useState } from "react";

type AppSettingsContextValue = {
  debugEnabled: boolean;
  setDebugEnabled: (value: boolean) => void;
  showHandOverlay: boolean;
  setShowHandOverlay: (value: boolean) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [showHandOverlay, setShowHandOverlay] = useState(false);

  const value = useMemo(
    () => ({
      debugEnabled,
      setDebugEnabled,
      showHandOverlay,
      setShowHandOverlay,
    }),
    [debugEnabled, showHandOverlay]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return context;
}
