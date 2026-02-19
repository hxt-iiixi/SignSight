import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export type HandPoint = { x: number; y: number; z: number };
export type HandResult = { landmarks: HandPoint[] | null; handedness?: string | null };

export type HandWebViewHandle = {
  process: (base64Jpeg: string) => Promise<HandResult>;
};

type Pending = {
  resolve: (r: HandResult) => void;
  reject: (e: any) => void;
  timeout: any;
};

type Props = {
  html: string;
  debug?: boolean;
  timeoutMs?: number;
};

export const HandLandmarksWebView = forwardRef<HandWebViewHandle, Props>(
  ({ html, debug = false, timeoutMs = 2500 }, ref) => {
    const webViewRef = useRef<any>(null);

    const reqIdRef = useRef(1);
    const pendingRef = useRef<Map<number, Pending>>(new Map());

    // ✅ READY tracking (prevents missed READY)
    const isReadyRef = useRef(false);

    const pingReady = () => {
      try {
        webViewRef.current?.postMessage(JSON.stringify({ type: "PING_READY" }));
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      process: (base64Jpeg: string) => {
        return new Promise((resolve, reject) => {
          const reqId = reqIdRef.current++;
          const dataUrl = `data:image/jpeg;base64,${base64Jpeg}`;

          const timeout = setTimeout(() => {
            pendingRef.current.delete(reqId);
            reject(new Error("WebView MediaPipe timeout"));
          }, timeoutMs);

          pendingRef.current.set(reqId, { resolve, reject, timeout });

          // ✅ If READY was missed, re-ping before sending PROCESS
          if (!isReadyRef.current) pingReady();

          const msg = JSON.stringify({ type: "PROCESS", reqId, dataUrl });
          webViewRef.current?.postMessage(msg);
        });
      },
    }));

    const onMessage = (ev: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(ev.nativeEvent.data);
        if (debug) console.log("[HandWebView]", msg);

        if (msg.type === "READY") {
          isReadyRef.current = true;
          return;
        }

        if (msg.type === "RESULT") {
          const reqId: number = msg.reqId;
          const pending = pendingRef.current.get(reqId);
          if (!pending) return;

          clearTimeout(pending.timeout);
          pendingRef.current.delete(reqId);

          if (msg.ok) {
            pending.resolve({
              landmarks: msg.landmarks ?? null,
              handedness: msg.handedness ?? null,
            });
          } else {
            pending.reject(new Error(msg.error || "MediaPipe error"));
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return React.createElement(WebView as any, {
      ref: webViewRef,
      originWhitelist: ["*"],
      javaScriptEnabled: true,
      domStorageEnabled: true,
      onMessage,
      // ✅ onLoadEnd is the best moment to re-ping READY
      onLoadEnd: pingReady,
      source: { html },
      style: { width: 1, height: 1, opacity: 0, position: "absolute", left: -9999 },
    });
  }
);

HandLandmarksWebView.displayName = "HandLandmarksWebView";
