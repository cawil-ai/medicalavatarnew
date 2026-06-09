# Medical Avatar

> An AI-powered health monitoring web application that allows users to track health metrics across multiple modules — all synced to a cloud database via Appwrite.

---

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [Appwrite Database](#appwrite-database)
- [User Profile & Authentication](#user-profile--authentication)
- [Service Files](#service-files)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Team](#team)

---

## Overview

Medical Avatar is a full-stack AI-powered health monitoring web application. Users can track daily health metrics across eight modules — calories, sleep, hydration, heart rate, steps, mood, meditation, and journal — all synced in real time to a cloud database via Appwrite. The app includes an emotion detection feature, BMI/BMR calculator, AI-powered chat panels per module, and a user profile system that persists across sessions.

---

## Live Demo

🌐 **Deployed:** [https://medical-avatar-ptkw.onrender.com](https://medical-avatar-ptkw.onrender.com)

---

## Features

| Feature | Description |
|---|---|
| 8 Health Modules | Calories, Sleep, Hydration, Heart Rate, Steps, Mood, Meditation, Journal |
| Appwrite Sync | All health logs saved and loaded from Appwrite in real time, filtered per user and per day |
| User Authentication | Email/password login and signup via Appwrite Auth |
| Emotion Detection | Face-api.js reads user webcam and detects emotion at login |
| AI Chat Panels | Per-module chat assistant that responds to health-related queries |
| BMI / BMR Calculator | Computes BMI, BMR, TDEE, and recommended daily calories based on user profile |
| User Profile Persistence | Profile data saved to Appwrite and restored per user on login — clears when a different user logs in |
| Multi-user Safe | localStorage is keyed by user ID — switching accounts clears previous user's data |
| Weekly Charts | Chart.js bar, line, and doughnut charts for weekly trends per module |
| Responsive Design | Glassmorphism dark UI, mobile-friendly layout |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Styling | Inline CSS with glassmorphism dark design system |
| Backend / Database | Appwrite (BaaS — Auth, Databases, Storage) |
| Charts | Chart.js via `react-chartjs-2` |
| Emotion Detection | face-api.js (runs entirely in browser) |
| Notifications | Sonner (toast notifications) |
| Icons | Lucide React |
| Deployment | Render.com (auto-deploy from GitHub) |

---

## Project Structure

```
src/
├── pages/
│   ├── CaloriesPage.tsx       # Daily calorie and meal logging
│   ├── SleepPage.tsx          # Sleep duration and quality tracking
│   ├── HydrationPage.tsx      # Water intake tracking
│   ├── HeartPage.tsx          # Heart rate and BPM logging
│   ├── StepsPage.tsx          # Step count and distance tracking
│   ├── MoodTrackPage.tsx      # Daily mood logging
│   ├── MeditationPage.tsx     # Meditation session logging
│   ├── JournalPage.tsx        # Personal journal entries
│   ├── Login.tsx              # Login page with emotion detection
│   └── SignUp.tsx             # Account creation page
│
├── components/
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── Header.tsx             # Top header with user info
│   ├── ChatPanel.tsx          # Per-module AI chat assistant
│   └── EmotionDetector.tsx    # Webcam emotion detection on login
│
├── context/
│   └── UserProfileContext.tsx # Global user state — Appwrite sync, BMI, notifications
│
├── services/
│   ├── caloriesService.ts     # saveMealLog(), getTodayMeals(), getTodayCaloriesTotal()
│   ├── sleepService.ts        # saveSleepLog(), getLastSleep(), getWeeklySleep()
│   ├── hydrationService.ts    # saveHydrationLog(), getTodayHydrationTotal()
│   ├── heartService.ts        # saveHeartLog(), getLatestBpm(), getTodayHeartLogs()
│   ├── stepsService.ts        # saveStepsLog(), getTodayStepsTotal(), getWeeklySteps()
│   ├── moodService.ts         # saveMoodLog(), getTodayMood(), getWeeklyMoods()
│   ├── meditationService.ts   # saveMeditationSession(), getMeditationHistory()
│   ├── journalService.ts      # saveJournalEntry(), getAllJournalEntries(), deleteJournalEntry()
│   └── userService.ts         # createUserProfile(), getUserProfile(), updateUserProfile()
│
└── lib/
    └── appwrite.ts            # Appwrite client, DATABASE_ID, COLLECTIONS, helpers
```

---

## Modules

Each module follows the same pattern: a page component loads today's data on mount, displays it, and provides a modal form to log a new entry. On save, data is written to Appwrite and the list reloads.

| Module | Collection | Key Logged Fields |
|---|---|---|
| Calories | `calorie_logs` | `mealName`, `calories`, `mealType`, `mealTime`, `date` |
| Sleep | `sleep_logs` | `hoursSlept`, `bedTime`, `wakeTime`, `quality`, `interruptions` |
| Hydration | `hydration_logs` | `amountML`, `amountL`, `drinkType`, `dailyGoalL`, `date` |
| Heart Rate | `heart_logs` | `bpmLog`, `Zone`, `Activity`, `Resting`, `Date` |
| Steps | `steps_logs` | `steps`, `distanceKm`, `caloriesBurned`, `date` |
| Mood | `mood_logs` | `mood`, `note`, `date` |
| Meditation | `meditation_sessions` | `sessionType`, `durationMinutes`, `completedMins`, `date` |
| Journal | `journal_entries` | `userid` (lowercase), `title`, `content`, `mood`, `date` |

### Save Button Logic (consistent across all modules)

Every module's save button follows this exact pattern:

```ts
const handleSave = async (e) => {
  e.preventDefault();
  setSaving(true);                          // 1. Disable button, show "Saving..."
  try {
    const user = await account.get();       // 2. Get current logged-in user
    await databases.createDocument(         // 3. Save to Appwrite collection
      DATABASE_ID,
      COLLECTIONS.calories,                 //    collection ID from .env
      ID.unique(),                          //    auto-generated document ID
      {
        userID:   user.$id,                 //    ties record to this user
        mealName: form.foodName,
        calories: form.calories,
        date:     todayDate(),              //    "YYYY-MM-DD"
        loggedAt: new Date().toISOString(),
      }
    );
    toast.success('Logged!');               // 4. Success feedback
    setShowModal(false);
    await loadData();                       // 5. Refresh the list
  } catch (err) {
    toast.error('Failed to save.');         // 6. Error feedback
  } finally {
    setSaving(false);                       // 7. Re-enable button
  }
};
```

### Load Data Pattern (consistent across all modules)

```ts
const loadData = async () => {
  const user = await account.get();
  const res = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.calories,
    [
      Query.equal('userID', user.$id),   // only this user's records
      Query.equal('date', todayDate()),  // only today
      Query.orderDesc('loggedAt'),       // newest first
      Query.limit(100),
    ]
  );
  setMeals(res.documents.map(d => ({ ... })));
};
```

---

## Appwrite Database

All collections live in the `health_ai_db` database. Every collection uses `userID` to filter records per user.

### Connection (`lib/appwrite.ts`)

```ts
import { Client, Databases, Account, ID, Query } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account    = new Account(client);
export const databases  = new Databases(client);
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export { ID, Query };

export const COLLECTIONS = {
  heart:      import.meta.env.VITE_COLLECTION_HEART,
  sleep:      import.meta.env.VITE_COLLECTION_SLEEP,
  calories:   import.meta.env.VITE_COLLECTION_CALORIES,
  hydration:  import.meta.env.VITE_COLLECTION_HYDRATION,
  steps:      import.meta.env.VITE_COLLECTION_STEPS,
  journal:    import.meta.env.VITE_COLLECTION_JOURNAL,
  meditation: import.meta.env.VITE_COLLECTION_MEDITATION,
  mood:       import.meta.env.VITE_COLLECTION_MOOD,
  users:      import.meta.env.VITE_COLLECTION_USERS,
};

export const todayDate = () => new Date().toISOString().split('T')[0];
export const nowTime   = () => new Date().toTimeString().slice(0, 5);
```

### Collections Schema Reference

| Collection | Notable Fields | Gotchas |
|---|---|---|
| `calorie_logs` | `userID`, `mealName`, `calories`, `mealType`, `mealTime`, `date`, `loggedAt` | `note` is optional |
| `sleep_logs` | `userID`, `hoursSlept`, `bedTime`, `wakeTime`, `quality`, `interruptions`, `loggedAt` | `date` column is boolean — omit it |
| `hydration_logs` | `userID`, `amountML`, `amountL`, `drinkType`, `logTime`, `dailyGoalL`, `date` | Column is `amountML` with capital ML |
| `heart_logs` | `userID`, `bpmLog`, `Zone`, `Activity`, `Resting`, `Note`, `Date`, `loggedAt` | `Zone`, `Activity`, `Note`, `Date` are capitalized |
| `steps_logs` | `userID`, `steps`, `distanceKm`, `caloriesBurned`, `date`, `loggedAt` | `distanceKm` and `caloriesBurned` are auto-calculated |
| `mood_logs` | `userID`, `mood`, `note`, `date`, `loggedAt` | — |
| `meditation_sessions` | `userID`, `sessionType`, `durationMinutes`, `completedMins`, `date`, `loggedAt` | — |
| `journal_entries` | `userid`, `title`, `content`, `mood`, `date`, `loggedAt` | `userid` is all **lowercase** — unlike all other collections |
| `user_profiles` | `userID`, `name`, `email`, `bmi`, `heightCm`, `weightKg`, `detectedEmotion` | `bmi`, `heightCm`, `weightKg` are required — default to `0` on signup |

### Appwrite Console Setup

1. Create a project at [cloud.appwrite.io](https://cloud.appwrite.io)
2. Create a database with ID matching `VITE_APPWRITE_DATABASE_ID`
3. Create each collection listed above with matching field names and types
4. Under **Settings → Permissions** for each collection, add role `Users` with **Create**, **Read**, **Update** enabled
5. Under **Overview → Platforms**, add `localhost` for local development and your Render URL for production

---

## User Profile & Authentication

### Login Flow

```ts
// 1. Delete any existing session (prevents conflicts on re-login)
await account.deleteSession('current');

// 2. Create new session
await account.createEmailPasswordSession(email, password);

// 3. EmotionDetector runs — stores result in sessionStorage
sessionStorage.setItem('detectedEmotion', emotion);

// 4. Navigate to dashboard
navigate('/dashboard');
```

### Signup Flow

```ts
// 1. Create Appwrite Auth account
const user = await account.create(ID.unique(), email, password, name);

// 2. Auto-login
await account.createEmailPasswordSession(email, password);

// 3. Create user_profiles document (required fields default to 0)
await createUserProfile(user.$id, name, email);

// 4. Navigate to dashboard
navigate('/dashboard');
```

### UserProfileContext — Multi-User Safety

`UserProfileContext.tsx` is the global state provider. It wraps the entire app and handles loading, saving, and clearing profile data.

**Key behavior:** On mount, it checks `healthai_user_id` in localStorage. If a different user is logged in, it clears all localStorage data and resets state to defaults before loading the new user's profile from Appwrite. This prevents one user's data from appearing for another.

```ts
const savedUserId = localStorage.getItem('healthai_user_id');
if (savedUserId && savedUserId !== user.$id) {
  localStorage.removeItem('healthai_profile');
  localStorage.removeItem('healthai_notifications');
  setProfile(defaultProfile);   // reset to blank state
  setNotifications([]);
}
localStorage.setItem('healthai_user_id', user.$id);
```

`updateProfile()` saves changes to both localStorage (instant) and Appwrite (background sync).
`computeBMI()` calculates BMI, BMR, TDEE, and recommended daily calories — then saves to Appwrite.

---

## Service Files

Each service file in `src/services/` wraps the Appwrite call for its module. Pages import and call the service instead of calling Appwrite directly.

```ts
// Example — caloriesService.ts
export async function saveMealLog(
  userId: string, mealName: string,
  calories: number, mealType: string, note?: string
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.calories, ID.unique(),
    {
      userID: userId, mealName, calories, mealType,
      note: note || '',
      mealTime: nowTime(),
      date: todayDate(),
      loggedAt: new Date().toISOString(),
    }
  );
}
```

| Service | Key Functions |
|---|---|
| `caloriesService.ts` | `saveMealLog()`, `getTodayMeals()`, `getTodayCaloriesTotal()` |
| `sleepService.ts` | `saveSleepLog()`, `getLastSleep()`, `getWeeklySleep()` |
| `hydrationService.ts` | `saveHydrationLog()`, `getTodayHydrationTotal()`, `getTodayHydrationLogs()` |
| `heartService.ts` | `saveHeartLog()`, `getLatestBpm()`, `getTodayHeartLogs()` |
| `stepsService.ts` | `saveStepsLog()`, `getTodayStepsTotal()`, `getWeeklySteps()` |
| `moodService.ts` | `saveMoodLog()`, `getTodayMood()`, `getWeeklyMoods()` |
| `meditationService.ts` | `saveMeditationSession()`, `getCurrentStreak()`, `getMeditationHistory()` |
| `journalService.ts` | `saveJournalEntry()`, `getAllJournalEntries()`, `deleteJournalEntry()` |
| `userService.ts` | `createUserProfile()`, `getUserProfile()`, `updateUserProfile()` |

---

## Environment Variables

Create a `.env` file in the project root. **Never commit this file to GitHub.**

```env
# Appwrite
VITE_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=health_ai_db

# Collection IDs (must match your Appwrite collection IDs exactly)
VITE_COLLECTION_HEART=heart_logs
VITE_COLLECTION_SLEEP=sleep_logs
VITE_COLLECTION_CALORIES=calorie_logs
VITE_COLLECTION_HYDRATION=hydration_logs
VITE_COLLECTION_STEPS=steps_logs
VITE_COLLECTION_JOURNAL=journal_entries
VITE_COLLECTION_MEDITATION=meditation_sessions
VITE_COLLECTION_MOOD=mood_logs
VITE_COLLECTION_USERS=user_profiles
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Appwrite project with all collections configured

### Installation

```bash
# Clone the repository
git clone https://github.com/mariebihag/medical-avatar.git
cd medical-avatar

# Install dependencies
npm install

# Create environment file and fill in your values
cp .env.example .env

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## Deployment

The app is deployed on **Render.com** with auto-deploy enabled from GitHub.

### Push changes to GitHub

```bash
git add .
git commit -m "your message"
git push
```

Render automatically redeploys on every push to the main branch.

### CORS — Adding New Domains

If Appwrite blocks requests from a new domain:

1. Go to **Appwrite Console → Project → Settings → Platforms → Add Platform → Web**
2. Enter only the hostname — e.g. `medical-ai-avatar-iow7.onrender.com` (no `https://`)

### Render Environment Variables

All `.env` values must also be added manually in Render:
**Dashboard → Service → Environment → Add Environment Variable**

---

## Team

| Name | Role |
|---|---|
| Patrick Miguel Agbon | Developer |
| Marie Kazser Bihag | Developer |
| Trixxy Nicole Penuliar | Developer |

---

> Medical Avatar — AI-Powered Health Monitoring · Powered by Appwrite · React · TypeScript
