import { apiPost } from "./http";
import type { ScanResponse } from "../types/api";

export async function quickScanSolidity(file: File): Promise<ScanResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return apiPost<ScanResponse>("/api/scan/solidity", formData);
}