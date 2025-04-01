import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Canvas from "./Canvas.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Canvas />
  </StrictMode>
);
