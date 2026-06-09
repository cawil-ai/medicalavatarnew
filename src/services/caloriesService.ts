import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate, nowTime } from '../lib/appwrite';

export async function saveMealLog(
  userId: string, mealName: string, calories: number,
  mealType: string, note?: string
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.calories, ID.unique(),
    {
      userID:   userId,       // matches your column: userID
      mealName: mealName,     // matches your column: mealName
      calories: calories,     // matches your column: calories
      mealType: mealType,     // matches your column: mealType
      note:     note || '',   // matches your column: note
      mealTime: nowTime(),    // matches your column: mealTime
      date:     todayDate(),  // matches your column: date
      loggedAt: new Date().toISOString(), // matches your column: loggedAt
    }
  );
}

export async function getTodayMeals(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.calories,
    [Query.equal('userID', userId), Query.equal('date', todayDate()),
     Query.orderDesc('loggedAt'), Query.limit(100)]
  );
  return res.documents;
}

export async function getTodayCaloriesTotal(userId: string): Promise<number> {
  const meals = await getTodayMeals(userId);
  return meals.reduce((sum, doc) => sum + (doc.calories || 0), 0);
}