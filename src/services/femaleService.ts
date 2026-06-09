import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite';

export async function savePeriodLog(
  userId: string,
  date: string,              // ISO date (e.g. new Date().toISOString())
  flow: string,
  symptoms: string[] = [],
  mood?: string,
  note?: string
) {
  return await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.female_health,   // make sure this exists
    ID.unique(),
    {
      userID: userId,
      date: getDateOnlyISO(),
      flow: flow,
      symptoms: symptoms,
      mood: mood || '',
      note: note || ''
    }
  );
}

function getDateOnlyISO() {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export async function getPeriodLogsByDate(userId: string, date: string) {
  const res = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.female_health,
    [
      Query.equal('userID', userId),
      Query.equal('date', date),
      Query.orderDesc('$createdAt')
    ]
  );

  return res.documents;
}
export async function getAllPeriodLogs(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.female_health,
    [
      Query.equal('userID', userId),
      Query.orderDesc('date')
    ]
  );

  return res.documents;
}