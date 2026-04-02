import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEXT,
  TEXT_SECONDARY,
  BORDER,
  BG_CARD,
  RADIUS_LG,
  PAD_MD,
  PAD_SM,
} from "./labColors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type LabCollapsibleProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  count?: number;
};

export default function LabCollapsible({
  title,
  subtitle,
  children,
  defaultExpanded = false,
  count,
}: LabCollapsibleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        220,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.headerTextWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {count != null && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{count}</Text>
              </View>
            )}
          </View>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={TEXT_SECONDARY}
        />
      </Pressable>

      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_CARD,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: PAD_MD,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(243,244,246,0.92)",
    borderWidth: 1,
    borderColor: BORDER,
  },
  countText: {
    color: TEXT_SECONDARY,
    fontWeight: "900",
    fontSize: 11,
  },
  body: {
    paddingHorizontal: PAD_MD,
    paddingBottom: PAD_MD,
    paddingTop: PAD_SM,
    gap: 10,
  },
});
