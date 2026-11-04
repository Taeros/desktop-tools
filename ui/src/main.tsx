import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { start } from "./core/store";
import { App } from "./shell/App";
import "@fontsource/barlow-semi-condensed/300.css";
import "@fontsource/barlow-semi-condensed/400.css";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "./styles.css";

start();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
