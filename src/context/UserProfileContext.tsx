import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query, account } from '../lib/appwrite';

/* ── Types ───────────────────────────────────────────────────────── */
export interface UserProfile {
  name: string;
  email: string;
  avatar: string | null;
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
  goal: 'lose' | 'maintain' | 'gain';
  bmi: number | null;
  bmr: number | null;
  recommendedCalories: number | null;
  bmiEntered: boolean;
}

interface UserProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  computeBMI: (override?: Partial<UserProfile>) => void;
  notifications: string[];
  addNotification: (msg: string) => void;
  clearNotification: (idx: number) => void;
}

/* ── Helper exported function ────────────────────────────────────── */
export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#38bdf8' };
  if (bmi < 25)   return { label: 'Normal',      color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#f59e0b' };
  return             { label: 'Obese',           color: '#ef4444' };
}

/* ── Default state ───────────────────────────────────────────────── */
const defaultProfile: UserProfile = {
  name: '',               // ← intentionally blank; Appwrite fills this
  email: '',              // ← intentionally blank; Appwrite fills this
  avatar: null,
  height: 0,
  weight: 0,
  age: 0,
  gender: 'male',
  goal: 'maintain',
  bmi: null,
  bmr: null,
  recommendedCalories: null,
  bmiEntered: false,
};

/* ── Context ─────────────────────────────────────────────────────── */
const UserProfileContext = createContext<UserProfileContextType | null>(null);

/* ── Provider ────────────────────────────────────────────────────── */
export function UserProfileProvider({ children }: { children: ReactNode }) {

  // ✅ name & email are NEVER seeded from localStorage.
  // We start blank and always overwrite from Appwrite on mount.
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved   = localStorage.getItem('healthai_profile');
      const parsed  = saved ? JSON.parse(saved) : null;

      // Only restore non-identity fields from localStorage.
      // name & email are intentionally excluded — Appwrite always wins.
      return {
        ...defaultProfile,
        height:              parsed?.height              ?? defaultProfile.height,
        weight:              parsed?.weight              ?? defaultProfile.weight,
        age:                 parsed?.age                 ?? defaultProfile.age,
        gender:              parsed?.gender              ?? defaultProfile.gender,
        goal:                parsed?.goal                ?? defaultProfile.goal,
        bmi:                 parsed?.bmi                 ?? defaultProfile.bmi,
        bmr:                 parsed?.bmr                 ?? defaultProfile.bmr,
        recommendedCalories: parsed?.recommendedCalories ?? defaultProfile.recommendedCalories,
        bmiEntered:          parsed?.bmiEntered          ?? defaultProfile.bmiEntered,
        // ❌ name and email are deliberately NOT restored from localStorage
        name:  '',
        email: '',
      };
    } catch {
      return defaultProfile;
    }
  });

  const [notifications, setNotifications] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('healthai_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ── Load name/email from Appwrite on every mount ─────────────────
  useEffect(() => {
    const loadFromAppwrite = async () => {
      try {
        const user = await account.get();

        // If a different user logged in, wipe localStorage entirely
        const savedUserId = localStorage.getItem('healthai_user_id');
        if (savedUserId && savedUserId !== user.$id) {
          localStorage.removeItem('healthai_profile');
          localStorage.removeItem('healthai_notifications');
          setNotifications([]);
          // Reset all fields to defaults for the new user
          setProfile({
            ...defaultProfile,
            name:  user.name  || '',
            email: user.email || '',
          });
        }
        localStorage.setItem('healthai_user_id', user.$id);

        // ✅ Always set name & email from the live auth session first
        setProfile(prev => ({
          ...prev,
          name:  user.name  || '',
          email: user.email || '',
        }));

        // Then enrich with database fields (height, weight, bmi, etc.)
        const res = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.users,
          [Query.equal('userID', user.$id)]
        );

        if (res.documents.length > 0) {
          const doc = res.documents[0];
          setProfile(prev => ({
            ...prev,
            // name & email locked to auth — doc must not override them
            name:       user.name  || prev.name,
            email:      user.email || prev.email,
            height:     doc.heightCm  ?? prev.height,
            weight:     doc.weightKg  ?? prev.weight,
            bmi:        doc.bmi       ?? prev.bmi,
            age:        doc.age       ?? prev.age,
            gender:     doc.gender    ?? prev.gender,
            recommendedCalories: doc.recommendedCalories ?? prev.recommendedCalories,
            bmiEntered: doc.bmi != null,
          }));
        }
      } catch (err) {
        console.error('❌ Load profile error:', err);
      }
    };

    loadFromAppwrite();
  }, []);

  // ── Persist to localStorage whenever profile changes ─────────────
  useEffect(() => {
    localStorage.setItem('healthai_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('healthai_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // ── Save / upsert profile to Appwrite ────────────────────────────
  const saveToAppwrite = async (updated: UserProfile) => {
    try {
      const user = await account.get();
      const res  = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.users,
        [Query.equal('userID', user.$id)]
      );

      const payload = {
        userID:          user.$id,
        name:            updated.name,
        email:           updated.email,
        bmi:             updated.bmi    ?? 0,
        detectedEmotion: 'neutral',
        heightCm:        updated.height ?? 0,
        weightKg:        updated.weight ?? 0,
        age:             updated.age    ?? 0,
        gender:          updated.gender ?? 'male', // default
        recommendedCalories: updated.recommendedCalories ?? 0,
      };

      if (res.documents.length > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.users,
          res.documents[0].$id,
          payload
        );
        console.log('✅ Profile updated in Appwrite');
      } else {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.users,
          ID.unique(),
          payload
        );
        console.log('✅ Profile created in Appwrite');
      }
    } catch (err) {
      console.error('❌ Save profile error:', err);
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...updates };
      // Schedule save outside the setState call to avoid stale-closure issues
      setTimeout(() => saveToAppwrite(updated), 0);
      return updated;
    });
  };

  const addNotification = (msg: string) => {
    setNotifications(prev => [msg, ...prev].slice(0, 20));
  };

  const clearNotification = (idx: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== idx));
  };

  // const computeBMI = () => {
  //   const { height, weight, age, gender, goal } = profile;
  //   if (!height || !weight || !age) return;

  //   const heightM = height / 100;
  //   const bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));

  //   const bmr = gender === 'male'
  //     ? Math.round(10 * weight + 6.25 * height - 5 * age + 5)
  //     : Math.round(10 * weight + 6.25 * height - 5 * age - 161);

  //   const tdee = Math.round(bmr * 1.375);
  //   const calMap = { lose: tdee - 500, maintain: tdee, gain: tdee + 500 };
  //   const recommendedCalories = calMap[goal];

  //   const updated = { ...profile, bmi, bmr, recommendedCalories, bmiEntered: true };
  //   setProfile(updated);
  //   saveToAppwrite(updated);

  //   const goalLabel = goal === 'lose' ? 'Weight Loss' : goal === 'gain' ? 'Weight Gain' : 'Maintenance';
  //   addNotification(
  //     `BMI recorded: ${bmi} — Recommended daily intake: ${recommendedCalories} kcal (${goalLabel})`
  //   );
  // };
  const computeBMI = (override?: Partial<UserProfile>) => {
    const merged = { ...profile, ...override };

    const { height, weight, age, gender, goal } = merged;
    if (!height || !weight || !age) return;

    const heightM = height / 100;
    const bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));

    const bmr = gender === 'male'
      ? Math.round(10 * weight + 6.25 * height - 5 * age + 5)
      : Math.round(10 * weight + 6.25 * height - 5 * age - 161);

    const tdee = Math.round(bmr * 1.375);

    const calMap = {
      lose: tdee - 500,
      maintain: tdee,
      gain: tdee + 500,
    };

    const recommendedCalories = calMap[goal];

    const updated: UserProfile = {
      ...merged,
      bmi,
      bmr,
      recommendedCalories,
      bmiEntered: true,
    };

    setProfile(updated);        // ✅ updates UI
    saveToAppwrite(updated);    // ✅ SAVES TO DATABASE

    addNotification(
      `BMI: ${bmi} — ${recommendedCalories} kcal recommended`
    );
};

  return (
    <UserProfileContext.Provider value={{
      profile,
      updateProfile,
      computeBMI,
      notifications,
      addNotification,
      clearNotification,
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────────────── */
export function useUserProfile(): UserProfileContextType {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside UserProfileProvider');
  return ctx;
}