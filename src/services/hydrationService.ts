import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate, nowTime } from '../lib/appwrite';

export async function saveHydrationLog(
  userId: string, amountMl: number, drinkType = 'water', goalL = 2.5
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.hydration, ID.unique(),
    {
      userID:     userId,                              // matches your column: userID
      amountML:   amountMl,                           // matches your column: amountML (capital ML!)
      amountL:    parseFloat((amountMl / 1000).toFixed(3)), // matches your column: amountL
      drinkType:  drinkType,                          // matches your column: drinkType
      logTime:    nowTime(),                          // matches your column: logTime
      dailyGoalL: goalL,                              // matches your column: dailyGoalL
      date:       todayDate(),                        // matches your column: date
      loggedAt:   new Date().toISOString(),           // matches your column: loggedAt
    }
  );
}

export async function getTodayHydrationTotal(userId: string): Promise<number> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.hydration,
    [Query.equal('userID', userId), Query.equal('date', todayDate()), Query.limit(100)]
  );
  return res.documents.reduce((sum, doc) => sum + (doc.amountL || 0), 0);
}

export async function getTodayHydrationLogs(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.hydration,
    [Query.equal('userID', userId), Query.equal('date', todayDate()),
     Query.orderDesc('loggedAt'), Query.limit(50)]
  );
  return res.documents;
}