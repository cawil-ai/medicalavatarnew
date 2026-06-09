import { databases, DATABASE_ID, COLLECTIONS, ID, Query, todayDate } from '../lib/appwrite';

export async function saveJournalEntry(
  userId: string, text: string, mood: string, tags: string[]
) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.journal, ID.unique(),
    {
      userid:   userId,           // matches your column: userid (all lowercase!)
      title:    text.slice(0, 55), // matches your column: title
      content:  text,             // matches your column: content
      mood:     mood,             // matches your column: mood
      date:     todayDate(),      // matches your column: date
      loggedAt: new Date().toISOString(), // matches your column: loggedAt
    }
  );
}

export async function getAllJournalEntries(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.journal,
    [Query.equal('userid', userId), Query.orderDesc('loggedAt'), Query.limit(50)]
  );
  return res.documents;
}

export async function deleteJournalEntry(documentId: string) {
  return await databases.deleteDocument(
    DATABASE_ID, COLLECTIONS.journal, documentId
  );
}