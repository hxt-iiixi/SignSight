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
import { SPACING } from "../config/spacing";
import { 
  ACCENT as PRIMARY, 
  BORDER, 
  TEXT_SECONDARY as MUTED, 
  TEXT, 
  BG, 
  BG_CARD as CARD 
} from "../components/lab/shared/labColors";

type SettingsScreenProps = {
  onBack: () => void;
  debugEnabled: boolean;
  setDebugEnabled: (value: boolean) => void;
  showHandOverlay: boolean;
  setShowHandOverlay: (value: boolean) => void;
  onOpenLab: () => void;
};

export default function SettingsScreen({
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
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translator Preferences</Text>
        </View>

        <View style={styles.card}>
          <SettingRow
            title="Debug Mode"
            description="Enable diagnostics on camera screen."
            value={debugEnabled}
            onValueChange={setDebugEnabled}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Hand Overlay"
            description="Draw live landmark overlays on hand."
            value={showHandOverlay}
            onValueChange={setShowHandOverlay}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>
        </View>

        <Pressable style={styles.labCard} onPress={onOpenLab}>
          <View style={styles.labIcon}>
            <Ionicons name="construct-outline" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.labTitle}>Developer Lab</Text>
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
    padding: SPACING.SPACE_MD,
    paddingTop: SPACING.SPACE_2XL,
    paddingBottom: 110,
  },
  headBlock: {
    marginBottom: SPACING.SPACE_LG,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.TEXT_3XL,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.8,
  },
  pageSub: {
    marginTop: SPACING.SPACE_XXS,
    fontSize: TYPOGRAPHY.TEXT_SM,
    fontWeight: "700",
    color: MUTED,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.SPACE_LG,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.TEXT_XL,
    fontWeight: "800",
    color: TEXT,
  },
  sectionSub: {
    marginTop: SPACING.SPACE_XXS,
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
    gap: SPACING.SPACE_SM,
    padding: SPACING.SPACE_MD,
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
    marginTop: SPACING.SPACE_XXS,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: SPACING.SPACE_MD,
  },
  labCard: {
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: SPACING.SPACE_MD,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SPACE_MD,
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
    marginTop: SPACING.SPACE_XXS,
    color: MUTED,
    fontSize: TYPOGRAPHY.TEXT_SM,
    lineHeight: 19,
  },
});
