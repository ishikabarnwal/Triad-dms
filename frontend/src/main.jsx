import { MotionConfig } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./styles/index.css";
import App from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* "user" follows the OS setting: transforms are dropped when reduced motion is requested. */}
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" closeButton toastOptions={{ classNames: { title: "font-medium", description: "text-muted" } }} />
      </TooltipProvider>
    </MotionConfig>
  </React.StrictMode>,
);
