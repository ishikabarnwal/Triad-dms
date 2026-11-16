import { MotionConfig } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./styles/theme.scss";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* "user" follows the OS setting: transforms are dropped when reduced motion is requested. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" closeButton richColors={false} />
    </MotionConfig>
  </React.StrictMode>,
);
