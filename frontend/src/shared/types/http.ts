import type { ApiErrorPayload } from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: ApiErrorPayload | unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload
        ? normalizeDetail((payload as ApiErrorPayload).detail)
        : `HTTP ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function normalizeDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (typeof detail === "object" && detail !== null) {
    if ("message" in detail && typeof detail.message === "string") {
      return detail.message;
    }

    return JSON.stringify(detail, null, 2);
  }

  return "Unexpected API error";
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    ...init
  });

  return parseResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body?: BodyInit | null,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
    ...init
  });

  return parseResponse<T>(response);
}

export async function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    ...init
  });

  return parseResponse<T>(response);
}

export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | null | undefined>
): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}