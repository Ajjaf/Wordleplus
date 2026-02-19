import { lazy } from "react";
import { createActions } from "./actions.js";
import { createSelectors } from "./selectors.js";

export const key = "daily";
export const Screen = lazy(() => import("../../screens/DailyGameScreen.jsx"));

export { createActions, createSelectors };
