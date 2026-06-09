/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_DATABASE_ID: string;
  readonly VITE_COLLECTION_HEART: string;
  readonly VITE_COLLECTION_SLEEP: string;
  readonly VITE_COLLECTION_CALORIES: string;
  readonly VITE_COLLECTION_HYDRATION: string;
  readonly VITE_COLLECTION_STEPS: string;
  readonly VITE_COLLECTION_JOURNAL: string;
  readonly VITE_COLLECTION_MEDITATION: string;
  readonly VITE_COLLECTION_MOOD: string;
  readonly VITE_COLLECTION_USERS: string;
  readonly VITE_STRAVA_CLIENT_ID: string;
  readonly VITE_STRAVA_CLIENT_SECRET: string;
  readonly VITE_STRAVA_REFRESH_TOKEN: string;
  readonly VITE_STRAVA_ACCESS_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}