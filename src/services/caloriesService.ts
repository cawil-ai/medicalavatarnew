import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate, nowTime } from '../lib/appwrite';

export async function saveMealLog(
  userId: string, mealName: string, calories: number,
  mealType: string, note?: string,
  protein?: number, carbs?: number, fat?: number
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.calories, ID.unique(),
    {
      userID:   userId,       // matches your column: userID
      mealName: mealName,     // matches your column: mealName
      calories: calories,     // matches your column: calories
      protein:  protein || 0,
      carbs:    carbs || 0,
      fat:      fat || 0,
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

/** Per-day calorie totals for the last 7 calendar days (chronological). */
export async function getWeeklyCalories(userId: string): Promise<{ date: string; total: number }[]> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.calories,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(200)]
  );
  const byDay: Record<string, number> = {};
  res.documents.forEach((d: any) => {
    const day = d.date || (d.loggedAt || '').split('T')[0];
    if (day) byDay[day] = (byDay[day] || 0) + (d.calories || 0);
  });
  const out: { date: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().split('T')[0];
    out.push({ date: key, total: byDay[key] || 0 });
  }
  return out;
}