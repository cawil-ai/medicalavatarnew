import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate } from '../lib/appwrite';

export async function saveStepsLog(userId: string, steps: number) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.steps, ID.unique(),
    {
      userID:        userId,                                   // matches your column: userID
      steps:         steps,                                    // matches your column: steps
      distanceKm:    parseFloat((steps * 0.0007).toFixed(2)), // matches your column: distanceKm
      caloriesBurned: Math.round(steps * 0.04),               // matches your column: caloriesBurned
      date:          todayDate(),                              // matches your column: date
      loggedAt:      new Date().toISOString(),                 // matches your column: loggedAt
    }
  );
}

export async function getTodayStepsTotal(userId: string): Promise<number> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.steps,
    [Query.equal('userID', userId), Query.equal('date', todayDate()), Query.limit(50)]
  );
  return res.documents.reduce((sum, doc) => sum + (doc.steps || 0), 0);
}

export async function getWeeklySteps(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.steps,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(7)]
  );
  return res.documents;
}