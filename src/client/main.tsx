import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:24px;color:#fff;background:#0f0f14">Ошибка: root не найден</div>';
} else {
  try {
    createRoot(rootEl).render(<App />);
  } catch (e) {
    rootEl.innerHTML = `<div class="boot-msg">Ошибка запуска: ${
      e instanceof Error ? e.message : "unknown"
    }</div>`;
  }
}
