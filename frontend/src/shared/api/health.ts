import { apiGet } from "./http";
import type { HealthLiveResponse, HealthReadyResponse } from "../types/api";

export async function getLiveHealth(): Promise<HealthLiveResponse> {
  return apiGet<HealthLiveResponse>("/health/live");
}

export async function getReadyHealth(): Promise<HealthReadyResponse> {
  return apiGet<HealthReadyResponse>("/health/ready");
}