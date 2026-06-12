import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);

if (import.meta.env.PROD && isLocalPreview && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.filter((key) => key.startsWith("goalkeeper-sim")).forEach((key) => caches.delete(key));
      });
    }
  });
} else if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Приложение остается рабочим и без service worker.
    });
  });
}
