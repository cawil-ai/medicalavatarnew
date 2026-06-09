import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate } from '../lib/appwrite';

export async function saveMeditationSession(
  userId: string, sessionType: string,
  durationMinutes: number, completed: boolean, note = ''
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.meditation, ID.unique(),
    {
      userID:          userId,           // matches your column: userID
      sessionType:     sessionType,      // matches your column: sessionType
      durationMinutes: durationMinutes,  // matches your column: durationMinutes
      completedMins:   durationMinutes,  // matches your column: completedMins
      date:            todayDate(),      // matches your column: date
      loggedAt:        new Date().toISOString(), // matches your column: loggedAt
      // NOTE: completed, streak, note columns don't exist in your Appwrite yet — add them or skip
    }
  );
}

export async function getCurrentStreak(userId: string): Promise<number> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.meditation,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(1)]
  );
  return res.total ?? 0;
}

export async function getMeditationHistory(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.meditation,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(50)]
  );
  return res.documents;
}