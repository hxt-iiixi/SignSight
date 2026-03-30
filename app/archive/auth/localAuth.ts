import * as LocalAuthentication from "expo-local-authentication";

export type AuthAvailable = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supported: LocalAuthentication.AuthenticationType[];
  hasFace: boolean;
  hasFingerprint: boolean;
};

export async function getAuthAvailability(): Promise<AuthAvailable> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();

  const hasFace = supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  return { hasHardware, isEnrolled, supported, hasFace, hasFingerprint };
}

export async function authenticateWithBiometrics() {
  return await LocalAuthentication.authenticateAsync({
    promptMessage: "Verify your identity",
    cancelLabel: "Cancel",
    disableDeviceFallback: false, // allow device passcode fallback if user wants
  });
}
