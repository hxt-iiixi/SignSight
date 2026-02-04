export const handLandmarksHtml = `
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
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
  </head>

  <body>
    <canvas id="c"></canvas>

    <script>
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d");

      let hands = null;
      let isReady = false;
      let busy = false;

      function post(obj) {
        window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
      }

      function init() {
        hands = new Hands({
          locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands/\${file}\`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
          busy = false;

          const lm = results?.multiHandLandmarks?.[0];
          if (!lm) {
            post({ type: "landmarks", ok: false, reason: "no_hand" });
            return;
          }

          // 21 landmarks: each has x,y,z in [0..1] (z is relative depth)
          post({ type: "landmarks", ok: true, landmarks: lm });
        });

        isReady = true;
        post({ type: "ready" });
      }

      async function processBase64(dataUrl) {
        if (!isReady || !hands) return;
        if (busy) return;

        busy = true;

        const img = new Image();
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          try {
            await hands.send({ image: canvas });
          } catch (e) {
            busy = false;
            post({ type: "landmarks", ok: false, reason: "hands_error" });
          }
        };
        img.onerror = () => {
          busy = false;
          post({ type: "landmarks", ok: false, reason: "bad_image" });
        };

        img.src = dataUrl;
      }

      window.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "frame" && msg.dataUrl) {
            processBase64(msg.dataUrl);
          }
        } catch {}
      });

      init();
    </script>
  </body>
</html>
`;

