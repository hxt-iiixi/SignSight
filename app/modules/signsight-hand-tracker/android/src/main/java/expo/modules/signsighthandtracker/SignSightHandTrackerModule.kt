package expo.modules.signsighthandtracker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SignSightHandTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SignSightHandTracker")

    OnCreate {
      val reactContext = appContext.reactContext ?: return@OnCreate
      SignSightHandTrackerFrameProcessorPlugin.registerOnce(reactContext.applicationContext)
    }

    Function("getPluginName") {
      SignSightHandTrackerFrameProcessorPlugin.PLUGIN_NAME
    }

    Function("isSupported") {
      true
    }
  }
}
