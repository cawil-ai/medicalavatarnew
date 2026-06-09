import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate } from '../lib/appwrite';

export async function saveHeartLog(
  userId: string, bpm: number, zone: string,
  activity?: string, notes?: string
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.heart, ID.unique(),
    {
      userID:   userId,                    // matches your column: userID
      bpmLog:   bpm,                       // matches your column: bpmLog
      Zone:     zone,                      // matches your column: Zone
      Activity: activity || '',            // matches your column: Activity
      Resting:  zone === 'Resting',        // matches your column: Resting
      Note:     notes || '',               // matches your column: Note
      Date:     new Date().toISOString(),  // matches your column: Date (datetime)
      loggedAt: new Date().toISOString(),  // matches your column: loggedAt
    }
  );
}

export async function getLatestBpm(userId: string): Promise<number> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(1)]
  );
  return res.documents[0]?.bpmLog ?? 76;
}

export async function getTodayHeartLogs(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(100)]
  );
  return res.documents;
}