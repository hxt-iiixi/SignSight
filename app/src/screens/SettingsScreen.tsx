import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TYPOGRAPHY } from "../config/typography";

const PRIMARY = "#E66E19";
const BG = "#F8F7F6";
const CARD = "#FFFFFF";
const BORDER = "#E7D9D0";
const MUTED = "#976D4E";
const TEXT = "#1B130E";

type SettingsScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  setDebugEnabled: (value: boolean) => void;
  showHandOverlay: boolean;
  setShowHandOverlay: (value: boolean) => void;
  onOpenLab: () => void;
};

export default function SettingsScreen({
  onBack,
  debugEnabled,
  setDebugEnabled,
  showHandOverlay,
  setShowHandOverlay,
  onOpenLab,
}: SettingsScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>


      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headBlock}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSub}>Configure your experience and developer tools</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translator Preferences</Text>
          <Text style={styles.sectionSub}>
            Keep the main camera simple for users and enable debug tools only when needed.
          </Text>
        </View>

        <View style={styles.card}>
          <SettingRow
            title="Debug Mode"
            description="Show telemetry and diagnostics on the camera screen."
            value={debugEnabled}
            onValueChange={setDebugEnabled}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Hand Overlay"
            description="Draw live landmark overlays when debug tools are enabled."
            value={showHandOverlay}
            onValueChange={setShowHandOverlay}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>
          <Text style={styles.sectionSub}>
            Sample collection, gesture recording, and training live in Lab.
          </Text>
        </View>

        <Pressable style={styles.labCard} onPress={onOpenLab}>
          <View style={styles.labIcon}>
            <Ionicons name="construct-outline" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.labTitle}>Open Lab</Text>
            <Text style={styles.labSub}>
              Test recognition, collect samples, record gestures, and train models.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={MUTED} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E5D5C8", true: "rgba(230,110,25,0.45)" }}
        thumbColor={value ? PRIMARY : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  content: {
    padding: 16,
    paddingTop: 32,
    paddingBottom: 110,
  },
  headBlock: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.8,
  },
  pageSub: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: MUTED,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.TEXT_XL,
    fontWeight: "800",
    color: TEXT,
  },
  sectionSub: {
    marginTop: 4,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 20,
  },
  card: {
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_MD,
  },
  settingDesc: {
    marginTop: 4,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
  labCard: {
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  labIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(230,110,25,0.10)",
  },
  labTitle: {
    color: TEXT,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.TEXT_MD,
  },
  labSub: {
    marginTop: 4,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 19,
  },
});
