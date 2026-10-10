import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";


const root = createRoot(document.getElementById("root")!);
if (window.parent !== window && new URLSearchParams(window.location.search).get("__content_preview") === "1") {
  void import("./features/site-content/admin/PreviewApp").then(({ default: PreviewApp }) => root.render(<PreviewApp />));
} else {
  root.render(<App />);
}
