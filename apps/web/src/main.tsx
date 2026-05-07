import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Missing #app root element");
}

createRoot(app).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
