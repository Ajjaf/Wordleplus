import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ErrorNotificationProvider } from "./contexts/ErrorNotificationContext.jsx";

import App from "./App.jsx";
createRoot(document.getElementById("root")).render(
  <ErrorNotificationProvider>
    <App />
  </ErrorNotificationProvider>
);
