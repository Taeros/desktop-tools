import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { start } from "./core/store";
import { App } from "./shell/App";
import "./styles.css";

start();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
