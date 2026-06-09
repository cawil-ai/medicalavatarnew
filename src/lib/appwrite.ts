import { Client, Databases, Account, ID, Query, Permission, Role } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT as string)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID as string);

export const account    = new Account(client);
export const databases  = new Databases(client);
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID as string;
export { ID, Query, Permission, Role };

export const COLLECTIONS = {
  heart:      import.meta.env.VITE_COLLECTION_HEART      as string,
  sleep:      import.meta.env.VITE_COLLECTION_SLEEP      as string,
  calories:   import.meta.env.VITE_COLLECTION_CALORIES   as string,
  hydration:  import.meta.env.VITE_COLLECTION_HYDRATION  as string,
  steps:      import.meta.env.VITE_COLLECTION_STEPS      as string,
  journal:    import.meta.env.VITE_COLLECTION_JOURNAL    as string,
  meditation: import.meta.env.VITE_COLLECTION_MEDITATION as string,
  mood:       import.meta.env.VITE_COLLECTION_MOOD       as string,
  female_health: import.meta.env.VITE_COLLECTION_FEMALE_HEALTH as string,
  users:      import.meta.env.VITE_COLLECTION_USERS      as string,
};

// 🔍 DEBUG — remove after fixing
console.log('=== APPWRITE CONFIG CHECK ===');
console.log('endpoint:   ', import.meta.env.VITE_APPWRITE_ENDPOINT);
console.log('projectId:  ', import.meta.env.VITE_APPWRITE_PROJECT_ID);
console.log('databaseId: ', import.meta.env.VITE_APPWRITE_DATABASE_ID);
console.log('collections:', COLLECTIONS);
console.log('=============================');

export const todayDate = () => new Date().toISOString().split('T')[0];
export const nowTime   = () => new Date().toTimeString().slice(0, 5);