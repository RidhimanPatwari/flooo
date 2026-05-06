import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL(
      `${import.meta.env.BASE_URL}service-worker.js`,
      window.location.href
    ).toString();

    navigator.serviceWorker.register(serviceWorkerUrl).catch(() => {
      // The app remains usable if PWA registration is unavailable.
    });
  });
}
