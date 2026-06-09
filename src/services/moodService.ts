import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate, nowTime } from '../lib/appwrite';

export async function saveMoodLog(
  userId: string, mood: string, note = '', intensity = 5
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.mood, ID.unique(),
    {
      userID:   userId,       // matches your column: userID
      mood:     mood,         // matches your column: mood
      note:     note,         // matches your column: note
      date:     todayDate(),  // matches your column: date
      loggedAt: new Date().toISOString(), // matches your column: loggedAt
    }
  );
}

export async function getTodayMood(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.mood,
    [Query.equal('userID', userId), Query.equal('date', todayDate()), Query.limit(1)]
  );
  return res.documents[0] ?? null;
}

export async function getWeeklyMoods(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.mood,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(7)]
  );
  return res.documents;
}