import { API_BASE } from "../../../config/api";

type FeedbackPayload = {
  message: string;
  category: string;
  rating: number | null;
  platform: string;
  appVersion: string;
  device: string;
};

export async function submitFeedback(payload: FeedbackPayload) {
  return fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.message,
      category: payload.category,
      rating: payload.rating,
      platform: payload.platform,
      app_version: payload.appVersion,
      device: payload.device,
    }),
  });
}

export async function submitMultipartFeedback(
  payload: FeedbackPayload,
  files: Array<{ uri: string; name: string; type: string }>
) {
  const formData = new FormData();
  formData.append("message", payload.message);
  formData.append("category", payload.category);
  if (payload.rating != null) {
    formData.append("rating", String(payload.rating));
  }
  formData.append("platform", payload.platform);
  formData.append("app_version", payload.appVersion);
  formData.append("device", payload.device);

  files.forEach((file) => {
    formData.append("images", file as any);
  });

  return fetch(`${API_BASE}/feedback_multipart`, {
    method: "POST",
    body: formData,
  });
}
