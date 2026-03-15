export const HAND_WEBVIEW_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    />
    <style>
      html, body { margin:0; padding:0; background:#000; }
      video, canvas { display:none; }
    </style>

    <!-- MediaPipe Hands -->
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
  </head>

  <body>
    <canvas id="c"></canvas>

    <script>
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d");

      let hands = null;
      let isReady = false;
      let busy = false;

      // store the last request id so we can answer properly
      let currentReqId = null;

      function post(obj) {
        window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
      }

      function init() {
        hands = new Hands({
          locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands/\${file}\`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });

        hands.onResults((results) => {
          busy = false;

          const lm = results?.multiHandLandmarks?.[0];
          const handed =
            results?.multiHandedness?.[0]?.label ||
            null;

          if (!lm) {
            if (currentReqId != null) {
              post({ type: "RESULT", reqId: currentReqId, ok: false, error: "no_hand" });
              currentReqId = null;
            }
            return;
          }

          // ✅ Reply in the new protocol
          if (currentReqId != null) {
            post({
              type: "RESULT",
              reqId: currentReqId,
              ok: true,
              landmarks: lm,        // 21 points: {x,y,z}
              handedness: handed,   // "Left"/"Right" (best-effort)
            });
            currentReqId = null;
          }
        });

        isReady = true;
        post({ type: "READY" });
      }

      async function processDataUrl(reqId, dataUrl) {
        if (!isReady || !hands) return;

        // if still busy, reject this request fast
        if (busy) {
          post({ type: "RESULT", reqId, ok: false, error: "busy" });
          return;
        }

        busy = true;
        currentReqId = reqId;

        const img = new Image();
        img.onload = async () => {
          const TARGET_W = 192; // ✅ try 256 (fast). If detection weak, try 320.
          const scale = TARGET_W / img.width;
          canvas.width = TARGET_W;
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          try {
            await hands.send({ image: canvas });
          } catch (e) {
            busy = false;
            post({ type: "RESULT", reqId, ok: false, error: "hands_error" });
            currentReqId = null;
          }
        };

        img.onerror = () => {
          busy = false;
          post({ type: "RESULT", reqId, ok: false, error: "bad_image" });
          currentReqId = null;
        };

        img.src = dataUrl;
      }

      // ✅ IMPORTANT: react-native-webview uses document events.
      // Android often uses "message" on document, iOS uses window.
      function onIncoming(ev) {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "PING_READY") {
            post({ type: "READY" });
            return;
          }
          // New wrapper protocol
          if (msg.type === "PROCESS" && msg.reqId && msg.dataUrl) {
            processDataUrl(msg.reqId, msg.dataUrl);
          }

          // (optional) backward compatibility:
          // old protocol: { type:"frame", dataUrl }
          if (msg.type === "frame" && msg.dataUrl) {
            processDataUrl(1, msg.dataUrl);
          }
        } catch {}
      }

      document.addEventListener("message", onIncoming);
      window.addEventListener("message", onIncoming);

      init();
    </script>
  </body>
</html>
`;
