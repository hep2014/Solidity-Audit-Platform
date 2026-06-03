import { createBrowserRouter } from "react-router-dom";

import { App } from "./App";
import { DashboardPage } from "../pages/DashboardPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectPage } from "../pages/ProjectPage";
import { AnalysisPage } from "../pages/AnalysisPage";
import { QuickScanPage } from "../pages/QuickScanPage";
import { HealthPage } from "../pages/HealthPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: "projects",
        element: <ProjectsPage />
      },
      {
        path: "projects/:projectId",
        element: <ProjectPage />
      },
      {
        path: "analyses/:analysisId",
        element: <AnalysisPage />
      },
      {
        path: "quick-scan",
        element: <QuickScanPage />
      },
      {
        path: "health",
        element: <HealthPage />
      },
      {
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
]);