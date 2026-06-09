import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite';

export async function saveSleepLog(
  userId: string, hoursSlept: number, bedTime: string,
  wakeTime: string, quality: string, note?: string
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.sleep, ID.unique(),
    {
      userID:       userId,       // matches your column: userID
      hoursSlept:   hoursSlept,   // matches your column: hoursSlept
      bedTime:      bedTime,      // matches your column: bedTime
      wakeTime:     wakeTime,     // matches your column: wakeTime
      quality:      quality,      // matches your column: quality
      note:         note || '',   // matches your column: note
      interruptions: 0,           // matches your column: interruptions
      loggedAt:     new Date().toISOString(), // matches your column: loggedAt
      // NOTE: 'date' column in Appwrite is boolean type — leave it out
    }
  );
}

export async function getLastSleep(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.sleep,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(1)]
  );
  return res.documents[0] ?? null;
}

export async function getWeeklySleep(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.sleep,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(7)]
  );
  return res.documents;
}