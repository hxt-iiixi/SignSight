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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#2EE6A6";

// ✅ make sure this matches your backend IP
const API_BASE = "http://192.168.1.7:8000";

const CATEGORIES = ["general", "bug", "feature", "ui"] as const;
type Category = (typeof CATEGORIES)[number];

export default function FeedbackScreen({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [rating, setRating] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
    const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus("Permission denied: Photos access needed to attach images.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 3, // ✅ keep small
    });

    if (res.canceled) return;
    setImages((prev) => {
      const next = [...prev, ...(res.assets || [])];
      return next.slice(0, 3);
    });
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
        // ✅ original JSON path
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
        // ✅ multipart path with optional images
        const fd = new FormData();
        fd.append("message", message.trim());
        fd.append("category", category);
        if (rating != null) fd.append("rating", String(rating));
        fd.append("platform", Platform.OS);
        fd.append("app_version", "1.0.0");
        fd.append("device", "unknown");

        images.forEach((img, idx) => {
          const uri = img.uri;
          const name = `feedback_${Date.now()}_${idx}.jpg`;
          fd.append("images", {
            uri,
            name,
            type: "image/jpeg",
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Anonymous Feedback</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View style={styles.iconBubble}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tell us what you think</Text>
              <Text style={styles.cardSub}>
                No name, no account — your message is stored anonymously.
              </Text>
            </View>
          </View>

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.rowWrap}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Rating */}
          <Text style={[styles.label, { marginTop: 12 }]}>Rating (optional)</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = rating === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRating(active ? null : n)}
                  style={[styles.starBtn, active && styles.starBtnActive]}
                >
                  <Ionicons
                    name={active ? "star" : "star-outline"}
                    size={18}
                    color={active ? "#0B0F14" : "rgba(255,255,255,0.85)"}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Message */}
          <Text style={[styles.label, { marginTop: 12 }]}>Message</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe a bug, request a feature, or share feedback..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              multiline
            />
            <Text style={styles.counter}>{message.trim().length}/500</Text>
          </View>
                    {/* Images (optional) */}
          <Text style={[styles.label, { marginTop: 12 }]}>Images (optional)</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <Pressable onPress={pickImages} style={styles.attachBtn}>
              <Ionicons name="images-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.attachText}>Attach (max 3)</Text>
            </Pressable>

            {images.map((img) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} />
                <Pressable onPress={() => removeImage(img.uri)} style={styles.thumbX}>
                  <Ionicons name="close" size={14} color="#0B0F14" />
                </Pressable>
              </View>
            ))}
          </View>
          {/* Submit */}
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.primaryBtn, !canSubmit && { opacity: 0.45 }]}
          >
            {loading ? (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={styles.primaryText}>Sending…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>Submit Feedback</Text>
            )}
          </Pressable>

          {!!status && <Text style={styles.status}>{status}</Text>}
        </View>

        <Text style={styles.footer}>
          Tip: Be specific (what you did, what happened, what you expected).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  backText: { color: "#fff", fontWeight: "900" },
  title: { color: "#fff", fontWeight: "900", fontSize: 16 },

  card: {
    marginTop: 14,
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
  },

  cardTopRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(46,230,166,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.6)", marginTop: 4, fontSize: 11, lineHeight: 15 },

  label: { marginTop: 14, color: "rgba(255,255,255,0.8)", fontWeight: "900", fontSize: 12 },

  rowWrap: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  chipActive: {
    borderColor: "rgba(46,230,166,0.55)",
    backgroundColor: "rgba(46,230,166,0.18)",
  },
  chipText: { color: "rgba(255,255,255,0.75)", fontWeight: "900", fontSize: 11 },
  chipTextActive: { color: "#fff" },

  starBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  starBtnActive: {
    borderColor: "rgba(46,230,166,0.6)",
    backgroundColor: ACCENT,
  },

  inputWrap: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
  },
  input: {
    color: "#fff",
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 13,
    lineHeight: 18,
  },
  counter: { marginTop: 10, color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "right" },

  primaryBtn: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(46,230,166,0.18)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.30)",
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  status: { marginTop: 12, color: "rgba(255,255,255,0.8)" },
  footer: { marginTop: "auto", paddingVertical: 14, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 10 },



    attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  attachText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  thumb: { width: "100%", height: "100%" },
  thumbX: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,230,166,0.95)",
  },
});
