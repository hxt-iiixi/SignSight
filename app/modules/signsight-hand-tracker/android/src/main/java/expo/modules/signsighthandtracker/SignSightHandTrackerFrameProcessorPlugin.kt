package expo.modules.signsighthandtracker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

private const val TARGET_INFERENCE_LONG_EDGE = 640
private const val TARGET_INFERENCE_SHORT_EDGE = 480

internal class SignSightHandTrackerFrameProcessorPlugin(
  private val controller: SignSightHandTrackerHandLandmarkerController
) : FrameProcessorPlugin() {
  override fun callback(frame: Frame, params: MutableMap<String, Any>?): Any? {
    val minProcessIntervalMs = (params?.get("minProcessIntervalMs") as? Number)?.toLong() ?: 30L
    val maxResultAgeMs = (params?.get("maxResultAgeMs") as? Number)?.toLong() ?: 500L

    controller.maybeProcessFrame(frame, minProcessIntervalMs)
    return controller.getLatestResult(maxResultAgeMs)
  }

  companion object {
    const val PLUGIN_NAME = "signsightDetectHands"

    private val isRegistered = AtomicBoolean(false)

    fun registerOnce(context: Context) {
      if (!isRegistered.compareAndSet(false, true)) {
        return
      }

      val appContext = context.applicationContext
      val controller = SignSightHandTrackerHandLandmarkerController(appContext)

      FrameProcessorPluginRegistry.addFrameProcessorPlugin(PLUGIN_NAME) { _: VisionCameraProxy, _: Map<String, Any>? ->
        SignSightHandTrackerFrameProcessorPlugin(controller)
      }
    }
  }
}

internal class SignSightHandTrackerHandLandmarkerController(
  context: Context
) {
  private val handLandmarker: HandLandmarker
  private val latestSnapshot = AtomicResultSnapshot()
  private val lastProcessTimestampMs = AtomicLong(0)

  init {
    handLandmarker = SignSightHandTrackerMediaPipeFactory.create(context) { result, timestampMs ->
      latestSnapshot.update(result, timestampMs)
    }
  }

  fun maybeProcessFrame(frame: Frame, minProcessIntervalMs: Long) {
    val imageProxy = frame.imageProxy ?: return
    val timestampMs = SystemClock.uptimeMillis()
    val previous = lastProcessTimestampMs.get()
    if (timestampMs - previous < minProcessIntervalMs) {
      return
    }
    if (!lastProcessTimestampMs.compareAndSet(previous, timestampMs)) {
      return
    }

    try {
      val bitmap = imageProxyToBitmap(imageProxy)
      val rotatedBitmap = rotateBitmap(bitmap, imageProxy.imageInfo.rotationDegrees, frame.isMirrored)
      val inferenceBitmap = resizeBitmapForInference(rotatedBitmap)
      val mpImage = BitmapImageBuilder(inferenceBitmap).build()
      handLandmarker.detectAsync(mpImage, timestampMs)
    } catch (_: Throwable) {
    }
  }

  fun getLatestResult(maxResultAgeMs: Long): Map<String, Any?>? {
    return latestSnapshot.toMap(maxResultAgeMs)
  }
}

private object SignSightHandTrackerMediaPipeFactory {
  private const val MODEL_ASSET_PATH = "hand_landmarker.task"

  fun create(
    context: Context,
    onResult: (HandLandmarkerResult, Long) -> Unit
  ): HandLandmarker {
    val baseOptions = com.google.mediapipe.tasks.core.BaseOptions.builder()
      .setModelAssetPath(MODEL_ASSET_PATH)
      .build()

    val options = HandLandmarker.HandLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setNumHands(1)
      .setMinHandDetectionConfidence(0.45f)
      .setMinHandPresenceConfidence(0.45f)
      .setMinTrackingConfidence(0.45f)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setResultListener { result, _ ->
        val timestampMs = result.timestampMs()
        onResult(result, timestampMs)
      }
      .build()

    return HandLandmarker.createFromOptions(context, options)
  }
}

private class AtomicResultSnapshot {
  @Volatile
  private var latest: HandTrackingResultSnapshot? = null

  fun update(result: HandLandmarkerResult, timestampMs: Long) {
    val landmarks = result.landmarks().firstOrNull()
    val handedness = result.handedness().firstOrNull()?.firstOrNull()?.categoryName()

    latest = HandTrackingResultSnapshot(
      landmarks = landmarks?.map(::landmarkToMap),
      handedness = handedness,
      timestampMs = timestampMs,
      hasHand = landmarks != null,
      sequenceId = timestampMs
    )
  }

  fun toMap(maxResultAgeMs: Long): Map<String, Any?>? {
    val snapshot = latest ?: return null
    val ageMs = SystemClock.uptimeMillis() - snapshot.timestampMs
    if (ageMs > maxResultAgeMs) {
      return mapOf(
        "landmarks" to null,
        "handedness" to null,
        "timestampMs" to snapshot.timestampMs.toDouble(),
        "hasHand" to false,
        "sequenceId" to snapshot.sequenceId.toDouble()
      )
    }

    return mapOf(
      "landmarks" to snapshot.landmarks,
      "handedness" to snapshot.handedness,
      "timestampMs" to snapshot.timestampMs.toDouble(),
      "hasHand" to snapshot.hasHand,
      "sequenceId" to snapshot.sequenceId.toDouble()
    )
  }

  private fun landmarkToMap(landmark: NormalizedLandmark): Map<String, Double> {
    return mapOf(
      "x" to landmark.x().toDouble(),
      "y" to landmark.y().toDouble(),
      "z" to landmark.z().toDouble()
    )
  }
}

private data class HandTrackingResultSnapshot(
  val landmarks: List<Map<String, Double>>?,
  val handedness: String?,
  val timestampMs: Long,
  val hasHand: Boolean,
  val sequenceId: Long
)

private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap {
  val plane = imageProxy.planes.firstOrNull()
    ?: throw IllegalStateException("Frame does not contain RGBA plane data")
  val width = imageProxy.width
  val height = imageProxy.height
  val rowStride = plane.rowStride
  val pixelStride = plane.pixelStride
  val buffer = plane.buffer

  if (pixelStride == 4 && rowStride == width * 4) {
    buffer.rewind()
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
      copyPixelsFromBuffer(buffer)
    }
  }

  val rowData = ByteArray(rowStride)
  val pixels = IntArray(width * height)
  buffer.rewind()

  for (y in 0 until height) {
    buffer.position(y * rowStride)
    buffer.get(rowData, 0, rowStride)

    for (x in 0 until width) {
      val offset = x * pixelStride
      val r = rowData[offset].toInt() and 0xFF
      val g = rowData[offset + 1].toInt() and 0xFF
      val b = rowData[offset + 2].toInt() and 0xFF
      val a = rowData[offset + 3].toInt() and 0xFF
      pixels[y * width + x] = Color.argb(a, r, g, b)
    }
  }

  return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
    setPixels(pixels, 0, width, 0, 0, width, height)
  }
}

private fun rotateBitmap(bitmap: Bitmap, rotationDegrees: Int, isMirrored: Boolean): Bitmap {
  if (rotationDegrees == 0 && !isMirrored) {
    return bitmap
  }

  val matrix = Matrix().apply {
    postRotate(rotationDegrees.toFloat())
    if (isMirrored) {
      postScale(-1f, 1f, bitmap.width / 2f, bitmap.height / 2f)
    }
  }

  return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}

private fun resizeBitmapForInference(bitmap: Bitmap): Bitmap {
  val width = bitmap.width
  val height = bitmap.height
  if (width <= 0 || height <= 0) {
    return bitmap
  }

  val longEdge = maxOf(width, height).toFloat()
  val shortEdge = minOf(width, height).toFloat()
  val scale = minOf(
    1f,
    TARGET_INFERENCE_LONG_EDGE / longEdge,
    TARGET_INFERENCE_SHORT_EDGE / shortEdge
  )

  if (scale >= 0.999f) {
    return bitmap
  }

  val targetWidth = maxOf(1, (width * scale).toInt())
  val targetHeight = maxOf(1, (height * scale).toInt())
  return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
}
