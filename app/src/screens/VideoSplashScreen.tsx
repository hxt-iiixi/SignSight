import React, { useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Video, ResizeMode } from "expo-av";

export default function VideoSplashScreen({ onFinish }: { onFinish: () => void }) {
  const doneRef = useRef(false);

  const finishOnce = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish();
  };

  return (
    <Pressable style={styles.container} onPress={finishOnce}>
      <Video
        source={require("../../assets/splash/splash.mp4")}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) finishOnce();
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
});
