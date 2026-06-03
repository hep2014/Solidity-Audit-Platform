import { apiDelete, apiGet, apiPost } from "./http";
import type {
  DeleteProjectResponse,
  ProjectRead,
  UUID
} from "../types/api";

export async function uploadProject(file: File): Promise<ProjectRead> {
  const formData = new FormData();
  formData.append("file", file);

  return apiPost<ProjectRead>("/api/projects/upload", formData);
}

export async function listProjects(): Promise<ProjectRead[]> {
  return apiGet<ProjectRead[]>("/api/projects");
}

export async function getProject(projectId: UUID): Promise<ProjectRead> {
  return apiGet<ProjectRead>(`/api/projects/${projectId}`);
}

export async function deleteProject(projectId: UUID): Promise<DeleteProjectResponse> {
  return apiDelete<DeleteProjectResponse>(`/api/projects/${projectId}`);
}