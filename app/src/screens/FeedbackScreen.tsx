import React, { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  TextInput,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  type DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE } from "../config/api";

const PRIMARY = "#E66E19";
const BG = "#F8F7F6";
const CARD = "#FFFFFF";
const BORDER = "#E7D9D0";
const MUTED = "#976D4E";
const TEXT = "#1B130E";

const CATEGORIES = ["general", "bug", "feature", "ui"] as const;
type Category = (typeof CATEGORIES)[number];

export default function FeedbackScreen({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [rating, setRating] = useState<number | null>(4);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [showCategories, setShowCategories] = useState(false);

  const pickImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        setStatus("Permission denied: Photos access needed to attach images.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.9,
        selectionLimit: 3,
      });

      if (res.canceled) return;

      setImages((prev) => {
        const next = [...prev, ...(res.assets || [])];
        return next.slice(0, 3);
      });
    } catch (e: any) {
      setStatus(`Image picker error: ${e?.message ?? "Unknown error"}`);
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((a) => a.uri !== uri));
  };

  const canSubmit = useMemo(() => message.trim().length >= 3 && !loading, [message, loading]);

  const submit = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      setStatus("");

      let res: Response;

      if (images.length === 0) {
        res = await fetch(`${API_BASE}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.trim(),
            category,
            rating,
            platform: Platform.OS,
            app_version: "1.0.0",
            device: "unknown",
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("message", message.trim());
        fd.append("category", category);
        if (rating != null) fd.append("rating", String(rating));
        fd.append("platform", Platform.OS);
        fd.append("app_version", "1.0.0");
        fd.append("device", "unknown");

      images.forEach((img, idx) => {
        const uri = img.uri;

        const fileName =
          img.fileName ||
          `feedback_${Date.now()}_${idx}.${(img.mimeType || "image/jpeg").split("/")[1] || "jpg"}`;

        const mimeType = img.mimeType || "image/jpeg";

        fd.append("images", {
          uri,
          name: fileName,
          type: mimeType,
        } as any);
      });

        res = await fetch(`${API_BASE}/feedback_multipart`, {
          method: "POST",
          body: fd,
        });
      }

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.ok === false) {
        setStatus(`Failed: ${json?.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setStatus("Sent ✅ Thank you for your feedback!");
      setMessage("");
      setRating(null);
      setCategory("general");
      setImages([]);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>


      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headBlock}>
          <Text style={styles.title}>Share your thoughts</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us grow and improve our service.
          </Text>
        </View>

        {/* Category */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category</Text>

          <Pressable
            style={styles.selectBox}
            onPress={() => setShowCategories((v) => !v)}
          >
            <Text style={[styles.selectText, !category && styles.placeholderText]}>
              {category ? category[0].toUpperCase() + category.slice(1) : "Select a category"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={MUTED} />
          </Pressable>

          {showCategories && (
            <View style={styles.dropdown}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setCategory(c);
                    setShowCategories(false);
                  }}
                  style={styles.dropdownItem}
                >
                  <Text style={styles.dropdownText}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>RATE YOUR EXPERIENCE</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (rating ?? 0) >= n;
              return (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <Ionicons
                    name={active ? "star" : "star-outline"}
                    size={34}
                    color={active ? PRIMARY : "#D8C9BF"}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Message */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what’s on your mind..."
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.messageInput}
          />
        </View>

        {/* Attachment */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Attachments (Optional)</Text>

          <Pressable onPress={pickImages} style={styles.attachmentBtn}>
            <Ionicons name="attach-outline" size={18} color={MUTED} />
            <Text style={styles.attachmentText}>Add screenshots or files</Text>
          </Pressable>

          {images.length > 0 && (
            <View style={styles.previewRow}>
              {images.map((img) => (
                <View key={img.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} />
                  <Pressable onPress={() => removeImage(img.uri)} style={styles.thumbX}>
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit */}
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
        >
          {loading ? (
            <View style={styles.submitRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitText}>Sending…</Text>
            </View>
          ) : (
            <View style={styles.submitRow}>
              <Text style={styles.submitText}>Submit Feedback</Text>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            </View>
          )}
        </Pressable>

        {!!status && <Text style={styles.status}>{status}</Text>}

        {/* Footer stats */}
        <View style={styles.footerStats}>
          <View style={styles.avgWrap}>
            <Text style={styles.avgValue}>4.8</Text>
            <View style={styles.avgStars}>
              <Ionicons name="star" size={14} color={PRIMARY} />
              <Ionicons name="star" size={14} color={PRIMARY} />
              <Ionicons name="star" size={14} color={PRIMARY} />
              <Ionicons name="star" size={14} color={PRIMARY} />
              <Ionicons name="star-half" size={14} color={PRIMARY} />
            </View>
            <Text style={styles.avgLabel}>AVERAGE RATING</Text>
          </View>

          <View style={styles.barsWrap}>
            <StatBar label="5" value="85%" width="85%" />
            <StatBar label="4" value="10%" width="10%" />
            <StatBar label="3" value="3%" width="3%" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBar({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: DimensionValue;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLeft}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }]} />
      </View>
      <Text style={styles.statRight}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },



  content: {
    padding: 16,
    paddingTop: 32,
    paddingBottom: 110,
  },

  headBlock: {
    marginTop: 12,
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
  },

  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },

  selectBox: {
    minHeight: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 16,
    color: TEXT,
  },
  placeholderText: {
    color: MUTED,
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(231,217,208,0.45)",
  },
  dropdownText: {
    fontSize: 15,
    color: TEXT,
  },

  ratingCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(231,217,208,0.5)",
    backgroundColor: "#fff",
    padding: 22,
    marginBottom: 18,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: MUTED,
    letterSpacing: 1.2,
  },
  starsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },

  messageInput: {
    minHeight: 130,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: TEXT,
    textAlignVertical: "top",
  },

  attachmentBtn: {
    minHeight: 56,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "transparent",
  },
  attachmentText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "600",
  },

  previewRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
  thumbWrap: {
    width: 62,
    height: 62,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbX: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  submitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  status: {
    marginTop: 12,
    textAlign: "center",
    color: TEXT,
    fontWeight: "700",
  },

  footerStats: {
    marginTop: 32,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "rgba(231,217,208,0.35)",
    gap: 20,
  },
  avgWrap: {
    alignItems: "center",
  },
  avgValue: {
    fontSize: 42,
    fontWeight: "900",
    color: TEXT,
  },
  avgStars: {
    marginTop: 4,
    flexDirection: "row",
    gap: 2,
  },
  avgLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: MUTED,
    letterSpacing: 1.4,
  },

  barsWrap: {
    gap: 10,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statLeft: {
    width: 12,
    fontSize: 12,
    fontWeight: "800",
    color: TEXT,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(231,217,208,0.45)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  statRight: {
    width: 34,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
  },
});
