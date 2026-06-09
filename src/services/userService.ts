import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite';

export async function createUserProfile(userId: string, name: string, email: string) {
  return await databases.createDocument(
    DATABASE_ID, COLLECTIONS.users, ID.unique(),
    {
      userID: userId,   // matches your column: userID
      name:   name,     // matches your column: name
      email:  email,    // matches your column: email
      // NOTE: bmi, detectedEmotion, heightCm, weightKg are required in your Appwrite!
      // We set placeholder values so it doesn't reject the document
      bmi:            0,
      detectedEmotion: '',
      heightCm:       0,
      weightKg:       0,
    }
  );
}

export async function getUserProfile(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.users,
    [Query.equal('userID', userId), Query.limit(1)]
  );
  return res.documents[0] ?? null;
}

export async function updateUserProfile(documentId: string, data: Record<string, any>) {
  return await databases.updateDocument(
    DATABASE_ID, COLLECTIONS.users, documentId,
    { ...data }
  );
}