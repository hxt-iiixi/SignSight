import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { BORDER, TEXT } from "../../../components/lab/shared/labColors";
import { SPACING } from "../../../config/spacing";
import { TYPOGRAPHY } from "../../../config/typography";

export function LabPageHeader({
  horizontalPadding = SPACING.SPACE_MD,
  title,
  onBack,
}: {
  horizontalPadding?: number;
  title: string;
  onBack: () => void;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          marginHorizontal: -horizontalPadding,
          paddingHorizontal: horizontalPadding,
        },
      ]}
    >
      <View style={[styles.side, styles.sideLeft]}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={[styles.side, styles.sideRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  side: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 52,
    justifyContent: "center",
  },
  sideLeft: {
    left: 0,
    alignItems: "flex-start",
  },
  sideRight: {
    right: 0,
    alignItems: "flex-end",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 15,
  },
  titleWrap: {
    position: "absolute",
    left: 52,
    right: 52,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: TEXT,
    fontSize: TYPOGRAPHY.TEXT_2XL,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
});
