import { createBrowserRouter } from "react-router";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { Dashboard } from "./pages/Dashboard";
import { HeartPage } from "./pages/HeartPage";
import { SleepPage } from "./pages/SleepPage";
import { HydrationPage } from "./pages/HydrationPage";
import { CaloriesPage } from "./pages/CaloriesPage";
import { StepsPage } from "./pages/StepsPage";
import { JournalPage } from "./pages/JournalPage.tsx";
import { MeditationPage } from "./pages/MeditationPage.tsx";
import { MoodTrackerPage } from "./pages/MoodTrackerPage.tsx";
import { FemaleHealthPage } from "./pages/FemaleHealthPage.tsx";

export const router = createBrowserRouter([
  { path: "/",          Component: Login },
  { path: "/signup",    Component: SignUp },
  { path: "/dashboard", Component: Dashboard },
  { path: "/heart",     Component: HeartPage },
  { path: "/sleep",     Component: SleepPage },
  { path: "/hydration", Component: HydrationPage },
  { path: "/calories",  Component: CaloriesPage },
  { path: "/steps",     Component: StepsPage },
  { path: "/journal",   Component: JournalPage },
  { path: "/meditation",Component: MeditationPage },
  { path: "/mood",      Component: MoodTrackerPage },
   { path: "/female-health", Component: FemaleHealthPage }, 
  { path: "*",          Component: Login },
]);