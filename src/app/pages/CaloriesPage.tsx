import { useState, useEffect, memo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { ChatPanel } from '../components/ChatPanel';
import { Flame, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { FoodItem, parseFoodInput } from '../../services/foodSearchService';
import { databases, DATABASE_ID, COLLECTIONS, ID, account, Query, Permission, Role } from '../../lib/appwrite';

const foodImg = '/assets/food.png';
const scaleImg = '/assets/foodscale.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

interface Meal { id?: string; category: string; foodName: string; calories: number; time: string; date?: string; protein?: number; carbs?: number; fat?: number; note?: string; }

export function CaloriesPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  const [newMeal, setNewMeal] = useState({ category: 'Breakfast', foodName: '', calories: 0, note: '', protein: 0, carbs: 0, fat: 0 });
  const [detectedItems, setDetectedItems] = useState<{name: string, cals: number, p: number, c: number, f: number}[]>([]);
  const [isManualCalorie, setIsManualCalorie] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [weeklyCalories, setWeeklyCalories] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [goal, setGoal] = useState(2200);


  useEffect(() => {
    loadCalorieData();

    const interval = setInterval(() => {
      loadCalorieData();
    }, 60000); // ✅ every minute

    return () => clearInterval(interval);
  }, []);

  // Auto-calculation and auto-matching of calories as user types / edits
  useEffect(() => {
    if (isManualCalorie) return;
    const handler = setTimeout(async () => {
      if (newMeal.foodName.trim().length > 0) {
        setParsing(true);
        const parsed = await parseFoodInput(newMeal.foodName);
        setDetectedItems(parsed);
        let totCals = 0, totP = 0, totC = 0, totF = 0;
        parsed.forEach(i => { totCals += i.cals; totP += i.p; totC += i.c; totF += i.f; });
        setNewMeal(prev => ({ ...prev, calories: totCals, protein: totP, carbs: totC, fat: totF }));
        setParsing(false);
      } else {
        setDetectedItems([]);
        setNewMeal(prev => ({ ...prev, calories: 0, protein: 0, carbs: 0, fat: 0 }));
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [newMeal.foodName, isManualCalorie]);

  const openAddMealModal = () => {
    setNewMeal({ category: 'Breakfast', foodName: '', calories: 0, note: '', protein: 0, carbs: 0, fat: 0 });
    setDetectedItems([]);
    setIsManualCalorie(false);
    setEditingMealId(null);
    setShowModal(true);
  };

  const openEditModal = (meal: Meal) => {
    if (!meal.id) return;
    setNewMeal({
      category: meal.category,
      foodName: meal.foodName,
      calories: meal.calories,
      note: meal.note || '',
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fat: meal.fat || 0
    });
    setDetectedItems([]);
    setIsManualCalorie(false); // Let the useEffect auto-parse the items
    setEditingMealId(meal.id);
    setShowModal(true);
  };

  const handleDeleteMeal = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.calories, id);
      toast.success("Meal deleted successfully!");
      loadCalorieData();
    } catch (err: any) {
      console.error('❌ Delete meal error:', err);
      toast.error(`Failed to delete meal: ${err.message || 'Unknown error'}`);
    }
  };
  const calculateWeeklyStreak = (docs: any[]) => {
    if (!docs.length) return 0;

    const today = new Date();

    // ✅ start of week (Monday)
    const start = new Date();
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const startStr = start.toLocaleDateString('en-CA');
    const todayStr = today.toLocaleDateString('en-CA');

    const uniqueDays = [...new Set(docs.map(d => d.date))];

    // ✅ filter only THIS WEEK
    const thisWeekDays = uniqueDays.filter(d => d >= startStr && d <= todayStr);

    return thisWeekDays.length;
  };


  const getWeeklyCalories = (docs: any[]) => {
    const today = new Date();

    // ✅ get start of week (Monday)
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    // create 7 days array
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toLocaleDateString('en-CA');
    });

    // ✅ sum calories per day
    const totals = weekDays.map(day => {
      return docs
        .filter(d => d.date === day)
        .reduce((sum, d) => sum + d.calories, 0);
    });

    return totals;
  };


  const loadCalorieData = async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA');
      let allDocs: any[] = [];

      const user = await account.get();
      // ✅ GET ALL DATA (for streak)
      const resAll = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.calories,
        [
          Query.equal('userID', user.$id),
          Query.orderDesc('date'),
          Query.limit(500) // ✅ FIX
        ]
      );
      allDocs = resAll.documents;

      const profileRes = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.users,
        [Query.equal('userID', user.$id)]
      );

      const profile = profileRes.documents[0];

      if (profile && profile.recommendedCalories) {
        setGoal(profile.recommendedCalories);
      }

      console.log('ALL calorie logs:', allDocs);

      // ✅ FILTER TODAY ONLY
      const todayMeals = allDocs.filter(
        d => d.date === today
      );

      // ✅ MAP TODAY DATA
      const mapped: Meal[] = todayMeals.map(d => ({
        id: d.$id,
        category: d.mealType || 'Snack',
        foodName: d.mealName || '',
        calories: d.calories || 0,
        time: d.mealTime || '',
        date: d.date,
        protein: d.protein || 0,
        carbs: d.carbs || 0,
        fat: d.fat || 0,
        note: d.note || ''
      }));

      setMeals(mapped);

      // ✅ STREAK USES ALL DATA
      setStreak(calculateWeeklyStreak(allDocs));
      console.log("Unique days:", [...new Set(allDocs.map(d => d.date))]);
      const weeklyCalories = getWeeklyCalories(allDocs);
      setWeeklyCalories(weeklyCalories);


    } catch (err) {
      console.error('❌ Load calorie error:', err);
    }
  };


  const totalCals = meals.reduce((s, m) => s + m.calories, 0);
  const totalPro = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);
  const pct = Math.min((totalCals / goal) * 100, 100);

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = new Date();
      const h = now.getHours();
      const time = `${h}:${String(now.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
      const today = new Date().toLocaleDateString('en-CA');

      let doc;

      const user = await account.get();
      if (editingMealId) {
        doc = await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.calories,
          editingMealId,
          {
            mealName: newMeal.foodName,
            calories: newMeal.calories,
            protein: newMeal.protein || 0,
            carbs: newMeal.carbs || 0,
            fat: newMeal.fat || 0,
            mealType: newMeal.category,
            note: newMeal.note || ''
          }
        );
      } else {
        try {
          doc = await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.calories,
            ID.unique(),
            {
              userID: user.$id,
              mealName: newMeal.foodName,
              calories: newMeal.calories,
              protein: newMeal.protein || 0,
              carbs: newMeal.carbs || 0,
              fat: newMeal.fat || 0,
              mealType: newMeal.category,
              note: newMeal.note || '',
              mealTime: time,
              date: today,
              loggedAt: now.toISOString(),
            }
          );
        } catch (saveErr: any) {
          console.warn('Appwrite save failed, possibly due to missing macro attributes. Falling back to macro-less save. Original error:', saveErr);
          try {
            doc = await databases.createDocument(
              DATABASE_ID,
              COLLECTIONS.calories,
              ID.unique(),
              {
                userID: user.$id,
                mealName: newMeal.foodName,
                calories: newMeal.calories,
                mealType: newMeal.category,
                note: newMeal.note || '',
                mealTime: time,
                date: today,
                loggedAt: now.toISOString(),
              }
            );
          } catch (fallbackErr) {
            throw fallbackErr;
          }
        }
      }
      console.log('✅ Meal saved:', doc);
      toast.success(editingMealId ? `Meal updated!` : `Meal logged!`);
      setShowModal(false);
      setEditingMealId(null);
      setNewMeal({ category: 'Breakfast', foodName: '', calories: 0, note: '', protein: 0, carbs: 0, fat: 0 });
      setDetectedItems([]);
      setIsManualCalorie(false);
      await loadCalorieData();
    } catch (err: any) {
      console.error('❌ Save meal error:', err);
      toast.error(`Failed to save meal: ${err.message || 'Unknown error. Check console.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remaining = goal - totalCals;
  const overBy = totalCals - goal;
  const isOver = totalCals > goal;
  const mealAvg = meals.length > 0 ? Math.round(totalCals / meals.length) : 0;
  const lastMeal = meals.length > 0 ? meals[meals.length - 1] : null;
  const avgCalories = meals.length ? Math.round(totalCals / meals.length) : 0;

  const hasLargeMeal = meals.some(m => m.calories >= 700);
  const hasSmallMeal = meals.some(m => m.calories <= 200);

  const categories = meals.map(m => m.category);
  const skippedBreakfast = !categories.includes("Breakfast");

  const lastMealCalories = lastMeal?.calories ?? 0;

  const mealQualityNote =
    hasLargeMeal
      ? "One of your meals was quite high in calories, so balance things out with lighter options."
      : hasSmallMeal
        ? "Some of your meals are quite light — make sure you're eating enough to stay energized."
        : "Your meals look fairly balanced so far.";
  ``


  const chatResponses: Record<string, string> = {
    // ── Daily Intake & Calories ───────────────────────────────────────────────
    calories: `
      You've consumed ${totalCals} kcal out of ${goal} kcal (${Math.round(pct)}%).

      ${isOver
        ? `You're over your goal by ${overBy} kcal. No worries — just go lighter for your next meals or tomorrow.`
        : `You still have ${remaining} kcal remaining today.`}

      ${mealQualityNote}
      ${skippedBreakfast ? "Skipping breakfast may lead to stronger hunger later in the day." : ""}
    `,
    intake: `
      You've logged ${totalCals} kcal across ${meals.length} meal${meals.length !== 1 ? "s" : ""} today.

      Goal: ${goal} kcal  
      Average per meal: ${avgCalories || "—"} kcal

      ${isOver
        ? `You're ${overBy} kcal over target — consider keeping your next meal lighter.`
        : `${remaining} kcal left to use.`}

      ${meals.length < 3 ? "You’ve logged relatively few meals — spreading intake throughout the day helps manage hunger better." : ""}
      `,
    total: `Your total calorie count today is ${totalCals} kcal. The daily goal is set at ${goal} kcal. ${isOver ? `Try to offset the surplus with a light dinner or an extra walk.` : `You're on track — ${remaining} kcal to go.`}`,
    today: `
      Here's your day so far:
      • Total: ${totalCals} kcal  
      • Meals logged: ${meals.length}  
      • Remaining: ${remaining > 0 ? `${remaining} kcal` : `${overBy} kcal over`}

      ${meals.length === 0
        ? "Start by logging your first meal to track your intake."
        : "Keep logging to maintain accuracy."}

      ${mealQualityNote}
      `,
    eaten: `
      You've eaten ${totalCals} kcal today across ${meals.length} item${meals.length !== 1 ? "s" : ""}.

      ${isOver
        ? `That's ${overBy} kcal over your goal. Try balancing it with lighter meals or a bit more activity.`
        : `You're at ${Math.round(pct)}% of your goal with ${remaining} kcal left.`}

      ${lastMeal
        ? `Your last entry (${lastMeal.foodName}, ${lastMeal.calories} kcal) is ${lastMeal.calories > 600 ? "quite heavy" : lastMeal.calories < 200 ? "very light" : "moderate"} — adjust your next meal accordingly.`
        : ""}
      `,
    consumed: `Consumed today: ${totalCals} kcal (${Math.round(pct)}% of your ${goal} kcal goal). ${isOver ? `You've gone over by ${overBy} kcal.` : `${remaining} kcal budget remaining.`} Logging consistently helps keep you accountable.`,
    burned: `Calorie burn data isn't tracked here directly, but as a general guide: a 70 kg person burns ~300–400 kcal/hr walking briskly, ~500–600 kcal/hr cycling, and ~700–900 kcal/hr running. Factor your activity into your ${goal} kcal daily goal.`,
    budget: `Your calorie budget is ${goal} kcal/day. So far you've used ${totalCals} kcal (${Math.round(pct)}%). ${isOver ? `You're ${overBy} kcal over — try a walk or a light dinner to compensate.` : `You have ${remaining} kcal left to work with today.`}`,

    // ── Goal & Target ─────────────────────────────────────────────────────────
    goal: `Your daily calorie goal is set at ${goal} kcal. You've hit ${Math.round(pct)}% of that today with ${totalCals} kcal. ${isOver ? `You've exceeded the target — no need to stress, just eat lighter tomorrow.` : `You're doing well — ${remaining} kcal remaining.`}`,
    target: `Daily target: ${goal} kcal. Current intake: ${totalCals} kcal. ${isOver ? `Over by ${overBy} kcal — consider skipping a heavy snack tonight.` : `You're on track with ${remaining} kcal left in your budget.`}`,
    limit: `Your daily calorie limit is ${goal} kcal. You've logged ${totalCals} kcal so far. ${isOver ? `You're ${overBy} kcal above the limit. One over day won't derail your goals, but try to be more mindful tomorrow.` : `Still within your limit — ${remaining} kcal to spare.`}`,
    progress: `
      Progress: ${totalCals} / ${goal} kcal (${Math.round(pct)}%)

      ${meals.length > 0
        ? `You've logged ${meals.length} meals with an average of ${avgCalories} kcal.`
        : "No meals logged yet — start tracking to see progress."}

      ${isOver
        ? "You're over today — a lighter dinner could help balance it."
        : "You're on track so far — keep it steady."}

      ${mealQualityNote}
      `,
    remaining: `You have ${remaining > 0 ? remaining + ' kcal remaining' : 'exceeded your goal by ' + overBy + ' kcal'} today. ${remaining > 0 ? `That's roughly ${remaining < 300 ? 'a small snack' : remaining < 600 ? 'one light meal' : 'one or two meals'} worth of food left.` : 'Try to balance it tomorrow with lighter meals.'}`,
    left: `${remaining > 0 ? `${remaining} kcal left in your budget for today. That's approximately ${remaining < 200 ? 'a piece of fruit or small snack' : remaining < 500 ? 'a balanced snack or small meal' : 'a full meal'}.` : `You're ${overBy} kcal over your daily goal. No need to stress — consistency over days matters more than one over.`}`,
    over: `${isOver ? `You're ${overBy} kcal over your ${goal} kcal goal today. This happens! You can offset it with a 30-minute walk (~200 kcal) or simply eat a bit lighter tomorrow.` : `You haven't exceeded your goal yet — you're at ${totalCals} kcal with ${remaining} kcal still remaining.`}`,

    // ── Meals & Logging ───────────────────────────────────────────────────────
    meal: `You've logged ${meals.length} meal${meals.length !== 1 ? 's' : ''} today totaling ${totalCals} kcal. ${lastMeal ? `Your most recent entry is ${lastMeal.foodName} (${lastMeal.calories} kcal) at ${lastMeal.time}.` : 'Add your first meal by tapping "+ Add Meal" above!'}`,
    meals: `Today's meal log: ${meals.length} item${meals.length !== 1 ? 's' : ''} recorded, totaling ${totalCals} kcal. ${mealAvg > 0 ? `Average per meal: ${mealAvg} kcal.` : ''} Tap "+ Add Meal" to keep your log up to date.`,
    food: `You've logged ${meals.length} food item${meals.length !== 1 ? 's' : ''} today for a total of ${totalCals} kcal. ${isOver ? `You're over your ${goal} kcal goal — try a light next meal.` : `${remaining} kcal left in today's budget. Keep logging to stay accurate.`}`,
    breakfast: `Breakfast is your most important meal — it kickstarts metabolism and helps regulate appetite throughout the day. A healthy breakfast is typically 300–500 kcal. ${meals.some(m => m.category === 'Breakfast') ? `You've already logged breakfast today.` : `You haven't logged breakfast yet — tap "+ Add Meal" to record it.`}`,
    lunch: `Lunch typically accounts for 25–35% of your daily calories (~550–770 kcal on a ${goal} kcal goal). ${meals.some(m => m.category === 'Lunch') ? `Lunch is already logged today.` : `You haven't logged lunch yet — add it when ready!`}`,
    dinner: `Dinner ideally makes up 30–35% of your daily calories. ${isOver ? `Since you're already over your goal, try to keep dinner light — salads, soups, or lean proteins work great.` : `You have ${remaining} kcal left, which gives you comfortable room for a balanced dinner.`}`,
    snack: `Healthy snacks of 100–200 kcal can prevent overeating at meals. ${meals.some(m => m.category === 'Snack') ? `You've logged a snack today.` : `No snack logged yet.`} Good options: Greek yogurt (~130 kcal), a banana (~90 kcal), or a handful of almonds (~160 kcal).`,
    log: `To log a meal, tap the "+ Add Meal" button at the top. Select a meal type, enter the food name, calories, and an optional note. Your total and progress bar update instantly after saving.`,
    add: `Adding meals is easy — press "+ Add Meal", choose Breakfast / Lunch / Dinner / Snack / Pre-Workout / Post-Workout, fill in the food name and calorie count, then hit "Save Meal". Your dashboard updates right away.`,
    record: `Consistent logging is the #1 habit behind successful calorie management. Studies show people who track their food eat 10–20% less without feeling restricted. Tap "+ Add Meal" to add your current meal.`,
    track: `Tracking calories accurately requires logging everything — including drinks, sauces, and cooking oils, which are easy to forget. Even rough estimates beat not logging. You've tracked ${meals.length} item${meals.length !== 1 ? 's' : ''} so far today.`,
    last: `${lastMeal ? `Your last logged meal is ${lastMeal.foodName} (${lastMeal.calories} kcal, ${lastMeal.category}) at ${lastMeal.time}.` : `You haven't logged any meals yet today. Tap "+ Add Meal" to get started!`}`,
    recent: `${lastMeal ? `Most recent entry: ${lastMeal.foodName} · ${lastMeal.calories} kcal · ${lastMeal.category} · ${lastMeal.time}.` : `No meals logged yet today.`} Your running total is ${totalCals} kcal.`,
    streak: `You're on a 6-day logging streak — amazing! Consistency in logging is strongly correlated with reaching calorie goals. Keep the streak alive by logging at least one meal every day.`,

    // ── Macros & Nutrition ────────────────────────────────────────────────────
    protein: `Protein is essential for muscle repair, satiety, and metabolism. For a ${goal} kcal diet, aim for 120–150g of protein/day (25–30% of calories). High-protein foods: chicken breast (~165 kcal/100g, 31g protein), eggs (~70 kcal each, 6g protein), Greek yogurt (~130 kcal, 17g protein).`,
    carbs: `Carbohydrates are your body's primary energy source. On a ${goal} kcal diet, 45–55% from carbs means roughly 248–303g/day. Focus on complex carbs — oats, brown rice, sweet potato — for sustained energy rather than spikes.`,
    carbohydrates: `Carbs supply quick energy and support brain function. Aim for 45–55% of your calories (${Math.round(goal * 0.5 / 4)}g/day approx). Prioritize whole grains, legumes, and vegetables over refined sugars and white bread.`,
    fat: `Dietary fat is crucial for hormones, brain health, and fat-soluble vitamin absorption. Aim for 20–35% of your daily calories (~49–85g/day on a ${goal} kcal goal). Prioritize healthy fats — avocado, nuts, olive oil, fatty fish.`,
    fibre: `Fibre aids digestion, controls blood sugar, and keeps you full longer — critical for calorie management. Aim for 25–38g/day. Top sources: lentils, black beans, broccoli, oats, chia seeds, and apples with skin.`,
    fiber: `Dietary fibre (target 25–38g/day) helps you feel full on fewer calories — a major advantage for staying within your ${goal} kcal goal. It also feeds beneficial gut bacteria and slows sugar absorption.`,
    sugar: `Added sugar adds calories with minimal nutritional value. The WHO recommends under 50g/day (ideally under 25g). Watch hidden sugars in sauces, drinks, flavoured yogurts, and packaged snacks — they add up fast.`,
    sodium: `Sodium doesn't add calories but affects water retention and blood pressure. Aim for under 2,300 mg/day. High-sodium foods: processed meats, canned soups, fast food, and soy sauce. Drinking more water helps flush excess sodium.`,
    macro: `Your key macronutrient targets on a ${goal} kcal diet: Protein ~30% (150g) · Carbs ~45% (248g) · Fat ~25% (61g). Tracking macros alongside calories gives you a clearer picture of food quality, not just quantity.`,
    macros: `Macro split for a ${goal} kcal goal: ~150g protein (600 kcal) · ~248g carbohydrates (990g kcal) · ~68g fat (610 kcal). These are estimates — your ideal ratios depend on your activity level and fitness goals.`,
    nutrition: `Good nutrition goes beyond calories. Ensure you're getting: sufficient protein for muscle and satiety, complex carbs for energy, healthy fats for hormones, and plenty of fibre and micronutrients from vegetables and whole foods.`,

    // ── Weight & Body Composition ─────────────────────────────────────────────
    weight: `To lose ~0.5 kg/week, you need a ~500 kcal daily deficit. To gain muscle, aim for a 200–300 kcal surplus. Your current goal of ${goal} kcal/day is your maintenance or target level — consistency over weeks is what drives results.`,
    lose: `Safe weight loss is 0.25–1 kg/week — achieved by a 250–1000 kcal daily deficit. At your ${goal} kcal goal, if your maintenance is ~2400 kcal, you're already in a gentle deficit. Pair this with strength training to preserve muscle mass.`,
    gain: `To gain muscle or weight, eat in a 200–500 kcal surplus above your maintenance. Prioritise protein (1.6–2.2g/kg bodyweight) and resistance training. A slow bulk of 0.25–0.5 kg/week minimises fat gain.`,
    maintain: `Weight maintenance happens when calories in ≈ calories out. Your ${goal} kcal goal is designed for this balance. Daily fluctuations are normal — focus on weekly averages rather than stressing about single days.`,
    deficit: `A calorie deficit means eating fewer calories than you burn. A 500 kcal/day deficit produces ~0.5 kg/week of fat loss. ${isOver ? `Today you're in a surplus of ${overBy} kcal, so no deficit today.` : `You've eaten ${totalCals} kcal — if your maintenance is above this, you're in a deficit today.`}`,
    surplus: `A calorie surplus means eating more than you burn. ${isOver ? `Today you're ${overBy} kcal above your ${goal} kcal goal.` : `You're not in surplus yet — ${remaining} kcal remaining in your budget.`} Small surpluses support muscle building; large surpluses lead to fat gain.`,
    metabolism: `Metabolism determines how many calories you burn at rest (BMR). Average BMR is ~1400–1800 kcal/day. Total daily burn (TDEE) adds activity: lightly active people burn ~1.3–1.5x BMR. Your ${goal} kcal goal likely reflects your estimated TDEE.`,
    bmi: `BMI (Body Mass Index) is calculated from height and weight, not calories. It's a rough health indicator. More useful for nutrition goals: focus on body composition — muscle vs. fat ratio — which consistent calorie logging and resistance training help optimize.`,

    // ── Weekly Trends & Stats ─────────────────────────────────────────────────
    week: `Your 7-day calorie data: Mon 1,980 · Tue 2,150 · Wed 2,320 · Thu 1,890 · Fri 2,100 · Sat 2,450 · Today ${totalCals}. Weekly average: ~${Math.round((1980 + 2150 + 2320 + 1890 + 2100 + 2450 + totalCals) / 7)} kcal/day vs your ${goal} kcal goal.`,
    weekly: `Weekly intake summary: your average this week is ~${Math.round((1980 + 2150 + 2320 + 1890 + 2100 + 2450 + totalCals) / 7)} kcal/day. Your best day was Saturday (2,450 kcal) and your lowest was Thursday (1,890 kcal). Consistency across the week matters more than any single day.`,
    trend: `Your calorie trend this week shows moderate variation — a low of 1,890 kcal and a high of 2,450 kcal. Aim to keep all days within ±200 kcal of your ${goal} kcal goal for the most stable energy and body composition results.`,
    average: `Your 7-day calorie average is ~${Math.round((1980 + 2150 + 2320 + 1890 + 2100 + 2450 + totalCals) / 7)} kcal/day. Your daily goal is ${goal} kcal. The weekly average is a much stronger predictor of long-term results than any single day's intake.`,
    history: `Your recent calorie history: Mon 1,980 · Tue 2,150 · Wed 2,320 · Thu 1,890 · Fri 2,100 · Sat 2,450 · Today ${totalCals}. Today's total will update as you log more meals.`,
    chart: `The 7-day bar chart shows your calorie intake per day. Today's bar (highlighted in orange) currently shows ${totalCals} kcal. The chart updates in real time as you log more meals today.`,
    stats: `Your calorie stats: Today ${totalCals} kcal · Goal ${goal} kcal · ${Math.round(pct)}% complete · ${meals.length} meals logged · ${mealAvg > 0 ? `${mealAvg} kcal/meal avg` : 'No meals yet'} · 6-day streak · 7-day avg ~${Math.round((1980 + 2150 + 2320 + 1890 + 2100 + 2450 + totalCals) / 7)} kcal.`,
    data: `Nutrition data for today: ${totalCals} kcal consumed · ${goal} kcal goal · ${Math.round(pct)}% progress · ${meals.length} items logged · ${remaining > 0 ? remaining + ' kcal remaining' : overBy + ' kcal over goal'}.`,

    // ── Meal Types & Timing ───────────────────────────────────────────────────
    preworkout: `Pre-workout meals should be eaten 1–3 hrs before training. Aim for 200–400 kcal with a balance of carbs and protein: banana + peanut butter (~280 kcal), oats + milk (~300 kcal), or a protein smoothie (~350 kcal). This fuels performance without causing discomfort.`,
    postworkout: `Post-workout nutrition is critical for recovery. Within 30–60 mins of training, aim for 300–500 kcal with high protein (25–40g) and moderate carbs to replenish glycogen. Options: protein shake + banana (~350 kcal), chicken + rice (~450 kcal), or Greek yogurt + berries (~250 kcal).`,
    timing: `Meal timing affects energy and appetite. A common approach: Breakfast 7–9 AM · Snack 10:30 AM · Lunch 12–1 PM · Snack 3:30 PM · Dinner 6–8 PM. Eating every 3–4 hrs prevents excessive hunger that leads to overeating.`,
    fasting: `Intermittent fasting (IF) compresses your eating window — commonly 16:8 (eat within 8 hrs, fast 16 hrs). It doesn't require eating less, just eating within a window. Some people find it easier to hit calorie goals within a defined window. Still log all meals for accuracy.`,
    eating: `Mindful eating — eating slowly, without distractions, and stopping at 80% full — naturally reduces calorie intake by 10–20% without counting. Pair it with logging for the most powerful results. You've eaten ${totalCals} kcal today.`,

    // ── Tips & Advice ─────────────────────────────────────────────────────────
    tips: `Top calorie management tips: ① Log every meal — even snacks. ② Fill half your plate with vegetables (low-cal, high-fibre). ③ Drink water before meals to reduce hunger. ④ Avoid liquid calories (juice, soda, alcohol). ⑤ Meal prep to avoid impulse eating.`,
    advice: `Based on your data: you're at ${totalCals} kcal today. ${isOver ? `You've exceeded your goal — consider a light, protein-rich dinner tonight and prioritise vegetables.` : `You're doing well. Focus on protein and vegetables for your remaining ${remaining} kcal to stay satisfied.`}`,
    help: `I can help you with: calorie totals, daily & weekly trends, macro guidance, meal timing, weight goals, food tips, and logging meals. Try asking about your progress, macros, a specific meal type, or what to eat next!`,
    hungry: `Feeling hungry with ${remaining > 0 ? remaining + ' kcal remaining' : 'your goal reached'}? ${remaining > 300 ? `You have room for a satisfying meal — choose high-protein and high-fibre options to stay full longer.` : `Try high-volume, low-calorie foods: cucumber, celery, leafy greens, or a broth-based soup. Drinking a large glass of water first can also reduce perceived hunger.`}`,
    full: `Feeling full is a great sign of portion control! Your satiety hormones (leptin and ghrelin) work best when meals are eaten slowly and you stop before feeling stuffed. You've consumed ${totalCals} kcal today — ${isOver ? 'slightly over goal.' : 'still within your budget.'}`,
    water: `Hydration is often confused with hunger — if you feel hungry soon after eating, try drinking 250–500 ml of water first. Aim for 2–3 litres/day. Water has zero calories and helps your body metabolize fat more efficiently.`,
    improve: `To improve your nutrition: ① Increase protein to 1.6–2g/kg body weight. ② Replace refined carbs with whole grains. ③ Eat more vegetables (aim for 5+ servings/day). ④ Log everything — even condiments and drinks. ⑤ Meal prep 2–3 days ahead to avoid poor choices.`,
    cheat: `One higher-calorie day won't derail your progress — it takes a 3,500 kcal surplus to gain 0.5 kg of fat. What matters is the weekly average. After a higher day, simply return to your ${goal} kcal target the next day without over-restricting.`,
    feedback: lastMeal
      ? `
    Your last meal: ${lastMeal.foodName} (${lastMeal.calories} kcal)

    This is ${lastMeal.calories > 700
        ? "quite calorie-dense"
        : lastMeal.calories < 200
          ? "very light"
          : "reasonably balanced"
      }.

    ${lastMeal.calories > 700
        ? "Try going lighter on your next meal or focus on protein and vegetables."
        : lastMeal.calories < 200
          ? "You might feel hungry again soon — consider adding protein or fibre next time."
          : "Nice portion control — keep it consistent."
      }
    `
      : `No meals logged yet.`,

  };

  //   const inputLower = input.toLowerCase();

  // if (inputLower.includes("feedback")) {
  //   return chatResponses.feedback;
  // }

  // if (inputLower.includes("last") || inputLower.includes("recent")) {
  //   return chatResponses.recent;
  // }

  // if (inputLower.includes("meal")) {
  //   return chatResponses.meal;
  // }



  /* ── Chart Data ─────────────────────────────────────────────── */
  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Calories',
      data: weeklyCalories,
      backgroundColor: meals.map((_, i) => i === 6 ? 'rgba(249,115,22,0.9)' : 'rgba(249,115,22,0.4)'),
      borderRadius: 8,
    }],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(8,20,50,0.95)', titleColor: '#fff', bodyColor: 'rgba(180,210,255,0.85)' },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
      x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
    },
  };

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)',
    borderRadius: '18px',
    padding: '20px 22px',
    transition: 'all 0.3s ease',
  };

  const metrics = [
    { label: 'Total Calories', value: totalCals, unit: 'kcal', color: '#f97316', icon: Flame, desc: `${goal} kcal goal` },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(22px);}  to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn   { from{opacity:0;} to{opacity:1;} }
        @keyframes ringPulse{ 0%{transform:scale(1);opacity:.6;} 100%{transform:scale(1.7);opacity:0;} }

        /* Food crate bobs gently */
        @keyframes foodBob {
          0%,100%{ transform:translateY(0) rotate(0deg); filter:drop-shadow(0 10px 24px rgba(0,0,0,0.45)); }
          40%    { transform:translateY(-8px) rotate(-1deg); filter:drop-shadow(0 18px 32px rgba(0,0,0,0.5)); }
          70%    { transform:translateY(-4px) rotate(0.8deg); }
        }
        /* Food scale sways */
        @keyframes scaleWobble {
          0%,100%{ transform:rotate(0deg) translateY(0); filter:drop-shadow(0 8px 20px rgba(0,0,0,0.4)); }
          30%    { transform:rotate(-1deg) translateY(-3px); filter:drop-shadow(0 12px 26px rgba(249,115,22,0.3)); }
          60%    { transform:rotate(0.8deg) translateY(-1px); }
        }
        /* Calorie fill bar */
        @keyframes barFill {
          from { width: 0%; }
        }

        .cal-card:hover  { transform:translateY(-3px) !important; box-shadow:0 12px 40px rgba(249,115,22,0.2) !important; }
        .organ-card:hover{ transform:translateY(-4px) scale(1.015) !important; }
        .add-meal-btn:hover { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(249,115,22,0.45) !important; }
        @keyframes streakPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.1) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }

        .cal-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(100,180,255,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .cal-input:focus { border-color:rgba(249,115,22,0.6); background:rgba(255,255,255,0.11); box-shadow:0 0 0 3px rgba(249,115,22,0.12); }
        .cal-input::placeholder { color:rgba(180,210,255,0.35); }

        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(249,115,22,0.25); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />

        <div className="main-content" style={{ padding: 0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 320px', gap: '22px', minHeight: 'calc(100vh - 73px)' }}>

            {/* ── MAIN COLUMN ─────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Page Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(249,115,22,0.15)', animation: 'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', background: 'rgba(249,115,22,0.2)', animation: 'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Flame size={22} color="#f97316" />
                    </div>
                  </div>
                  <div>
                    <h1 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '22px', margin: 0, letterSpacing: '-0.3px' }}>Calorie Tracker</h1>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '2px 0 0' }}>Track your nutrition and daily intake</p>
                  </div>
                </div>
                <button
                  className="add-meal-btn"
                  onClick={openAddMealModal}
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '12px', padding: '12px 22px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 18px rgba(249,115,22,0.35)', transition: 'all .2s ease', letterSpacing: '0.02em' }}
                >
                  + Add Meal
                </button>
              </div>

              {/* Food Image Cards + Streak */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>

                {/* Food Crate Card */}
                <div style={{ ...card, border: '1px solid rgba(249,115,22,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'absolute', bottom: '-24px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '80px', background: 'rgba(249,115,22,0.08)', filter: 'blur(32px)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <img src={foodImg} alt="Food" style={{ width: 150, height: 150, objectFit: 'contain', animation: 'foodBob 4.5s ease-in-out infinite', filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.45))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Today's Nutrition</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                      <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>{totalCals} kcal logged</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>{meals.length} items recorded</p>
                  </div>
                </div>

                {/* Scale Card */}
                <div style={{ ...card, border: '1px solid rgba(249,115,22,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'absolute', bottom: '-24px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '80px', background: 'rgba(249,115,22,0.06)', filter: 'blur(32px)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <img src={scaleImg} alt="Scale" style={{ width: 150, height: 150, objectFit: 'contain', animation: 'scaleWobble 5s ease-in-out infinite', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Calorie Balance</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: totalCals <= goal ? '#22c55e' : '#ef4444', boxShadow: `0 0 5px ${totalCals <= goal ? '#22c55e' : '#ef4444'}` }} />
                      <span style={{ color: totalCals <= goal ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 600 }}>
                        {goal - totalCals > 0 ? `${goal - totalCals} kcal remaining` : 'Goal reached'}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>Goal: {goal} kcal</p>
                  </div>
                </div>

                {/* Streak Card */}
                <div style={{ ...card, border: '1px solid rgba(251,191,36,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '80px', background: 'rgba(251,191,36,0.08)', filter: 'blur(32px)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <img src={streakImg} alt="Streak" style={{ width: 130, height: 130, objectFit: 'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.3s both' : 'none', filter: 'drop-shadow(0 0 28px rgba(251,191,36,0.55))' }} />
                    <div style={{ position: 'absolute', bottom: 6, right: -2, width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: '3px solid rgba(8,20,50,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.6s ease 0.6s both' : 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Logging Streak</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 5px #fbbf24' }} />
                      <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600 }}>{streak} {streak === 1 ? 'day' : 'days'} in a row</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>Meals logged daily</p>
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                {metrics.map((m, i) => {
                  const Icon = m.icon;
                  const maxMap: Record<string, number> = { 'Total Calories': goal, Protein: 120, Carbohydrates: 250, Fat: 65 };
                  const barW = Math.min((m.value / (maxMap[m.label] || 100)) * 100, 100);
                  return (
                    <div key={m.label} style={{ ...card, border: `1px solid ${m.color}22`, cursor: 'default' }} className="cal-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '9px', background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${m.color}30` }}>
                          <Icon size={16} color={m.color} />
                        </div>
                        <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{m.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '28px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{m.value}</span>
                        <span style={{ fontSize: '13px', color: m.color, fontWeight: 600 }}>{m.unit}</span>
                      </div>
                      <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: 0 }}>{m.desc}</p>
                      <div style={{ marginTop: '10px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ height: '100%', borderRadius: '2px', background: m.color, width: `${barW}%`, boxShadow: `0 0 6px ${m.color}`, transition: 'width 1s ease', animation: 'barFill 1.2s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily Progress Banner */}
              <div style={{
                background: 'linear-gradient(135deg,rgba(249,115,22,0.25),rgba(234,88,12,0.2))',
                backdropFilter: 'blur(20px)', border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '18px', padding: '20px 24px',
                animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(249,115,22,0.1)', filter: 'blur(35px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Daily Progress</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>
                      {totalCals} <span style={{ color: 'rgba(180,210,255,0.4)', fontWeight: 400 }}>/ {goal} kcal</span>
                    </p>
                  </div>
                  <span style={{ color: '#f97316', fontWeight: 800, fontSize: '22px' }}>{Math.round(pct)}%</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg,#f97316,#fbbf24)', width: `${pct}%`, boxShadow: '0 0 10px rgba(249,115,22,0.5)', transition: 'width 1.2s cubic-bezier(.4,0,.2,1)', animation: 'barFill 1.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px' }}>0 kcal</span>
                  <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px' }}>{goal} kcal goal</span>
                </div>
                {/* Daily Macro Flags */}
                {totalCals > 0 && (
                  <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                    {totalPro < (totalCals * 0.15 / 4) && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Low protein intake today</span>}
                    {totalCarbs > (totalCals * 0.60 / 4) && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>High carb intake today</span>}
                    {totalPro >= (totalCals * 0.25 / 4) && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Good protein intake</span>}
                    {totalPro >= (totalCals * 0.15 / 4) && totalPro < (totalCals * 0.25 / 4) && totalCarbs <= (totalCals * 0.60 / 4) && <span style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Balanced macros today</span>}
                  </div>
                )}
              </div>

              {/* Meal Log */}
              <div style={{ ...card, animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Today's Log</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Meal History</p>
                  </div>
                  <button onClick={openAddMealModal} style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '8px 14px', color: '#f97316', fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all .2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.15)'}>
                    + Add Meal
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {meals.length === 0 ? (
                    <p style={{ color: 'rgba(180,210,255,0.3)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No meals logged today. Add your first meal!</p>
                  ) : meals.map((meal, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,180,255,0.08)', borderRadius: '12px', transition: 'all .2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(249,115,22,0.07)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(249,115,22,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(100,180,255,0.08)'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Flame size={16} color="#f97316" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
                            <span style={{ color: '#e0f0ff', fontWeight: 600, fontSize: '14px' }}>{meal.foodName}</span>
                            <span style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '6px', padding: '1px 7px', color: '#f97316', fontSize: '10px', fontWeight: 700 }}>{meal.category}</span>
                          </div>
                          <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: 0 }}>{meal.time}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                        <span style={{ color: '#f97316', fontWeight: 700, fontSize: '16px' }}>{meal.calories}<span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', fontWeight: 400 }}> kcal</span></span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => openEditModal(meal)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Edit Meal">
                            <Edit2 size={15} color="rgba(180,210,255,0.6)" />
                          </button>
                          <button onClick={() => handleDeleteMeal(meal.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Delete Meal">
                            <Trash2 size={15} color="rgba(239,68,68,0.7)" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div style={{ ...card, padding: '22px', animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none' }}>
                <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Weekly</p>
                <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>7-Day Calorie Intake</p>
                <div style={{ height: '200px' }}>
                  <Bar options={chartOpts} data={weeklyData} />
                </div>
              </div>
            </div>

            {/* ── CHAT COLUMN ─────────────────────────────────── */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Nutrition AI"
                moduleKey="calories"
                responses={chatResponses}
                defaultResponse="I can help with your calorie totals, meal log, macros, weekly trends, weight goals, and nutrition tips. Try asking about your progress, remaining calories, a specific meal type, or what to eat next!"
                autoMessages={[{ text: `I can help with your calorie totals, meal log, macros, weekly trends, weight goals, and nutrition tips. Try asking about your progress, remaining calories, a specific meal type, or what to eat next!`, delay: 1500 }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Meal Modal ────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#0d1a38', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '22px', padding: '36px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'fadeUp .3s ease', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(249,115,22,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={20} color="#f97316" />
              </div>
              <div>
                <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0 }}>Add Meal</h4>
                <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>Log your food intake</p>
              </div>
            </div>

            <form onSubmit={handleAddMeal}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Meal Type</label>
                <select
                  className="cal-input"
                  value={newMeal.category}
                  onChange={e => setNewMeal({ ...newMeal, category: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'].map(m => (
                    <option key={m} value={m} style={{ background: '#0d1a38' }}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>What did you eat?</label>
                <textarea
                  className="cal-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="e.g. 1 cup steamed white rice, 2 fried chicken, 1 can coke"
                  value={newMeal.foodName}
                  onChange={e => {
                    setNewMeal({ ...newMeal, foodName: e.target.value });
                    setIsManualCalorie(false);
                  }}
                  required
                />
                {parsing && <div style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', marginTop: '6px' }}>Parsing and matching...</div>}
                {!parsing && detectedItems.length > 0 && (
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                    <p style={{ color: '#e0f0ff', fontSize: '12px', fontWeight: 600, margin: '0 0 6px' }}>Detected Items:</p>
                    {detectedItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                        <span style={{ color: 'rgba(180,210,255,0.8)', flex: 1, paddingRight: '8px' }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            className="cal-input"
                            style={{ width: '64px', padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}
                            value={item.cals === 0 ? '' : item.cals}
                            placeholder="0"
                            onChange={(e) => {
                              const newItems = [...detectedItems];
                              const oldCals = newItems[idx].cals;
                              const newCals = Number(e.target.value) || 0;
                              
                              if (oldCals > 0) {
                                const ratio = newCals / oldCals;
                                newItems[idx].p = Math.round(newItems[idx].p * ratio);
                                newItems[idx].c = Math.round(newItems[idx].c * ratio);
                                newItems[idx].f = Math.round(newItems[idx].f * ratio);
                              }
                              newItems[idx].cals = newCals;
                              setDetectedItems(newItems);
                              
                              let newTotCals = 0, newTotP = 0, newTotC = 0, newTotF = 0;
                              newItems.forEach(i => { newTotCals += i.cals; newTotP += i.p; newTotC += i.c; newTotF += i.f; });
                              setNewMeal(prev => ({ ...prev, calories: newTotCals, protein: newTotP, carbs: newTotC, fat: newTotF }));
                            }}
                          />
                          <span style={{ color: '#f97316', fontWeight: 600, width: '28px' }}>kcal</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', gap: '10px', fontSize: '11px' }}>
                      <span style={{ color: '#22c55e' }}>Pro: {newMeal.protein}g</span>
                      <span style={{ color: '#3b82f6' }}>Carb: {newMeal.carbs}g</span>
                      <span style={{ color: '#eab308' }}>Fat: {newMeal.fat}g</span>
                    </div>
                  </div>
                )}
                
                {/* Macro Flags */}
                {!parsing && detectedItems.length > 0 && newMeal.calories > 0 && (
                   <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                     {newMeal.carbs > (newMeal.calories * 0.5 / 4) && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>High Carb Meal Detected</span>}
                     {newMeal.protein > (newMeal.calories * 0.25 / 4) && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>High Protein Meal</span>}
                     {newMeal.fat > (newMeal.calories * 0.30 / 9) && <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>High Fat Meal</span>}
                     {newMeal.protein < (newMeal.calories * 0.15 / 4) && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>Low Protein Meal</span>}
                     {!(newMeal.carbs > (newMeal.calories * 0.5 / 4)) && !(newMeal.protein > (newMeal.calories * 0.25 / 4)) && !(newMeal.fat > (newMeal.calories * 0.30 / 9)) && !(newMeal.protein < (newMeal.calories * 0.15 / 4)) && <span style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>Balanced Meal Detected</span>}
                   </div>
                )}

                {isManualCalorie && (
                  <div style={{ color: '#fbbf24', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
                    Using custom manual calories
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '14px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Total Calories</label>
                  <input
                    type="number"
                    className="cal-input"
                    placeholder="e.g. 450"
                    value={newMeal.calories || ''}
                    onChange={e => {
                      setNewMeal({ ...newMeal, calories: Number(e.target.value) });
                      setIsManualCalorie(true);
                    }}
                    required
                    min={1}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Note <span style={{ color: 'rgba(180,210,255,0.3)', fontWeight: 400, textTransform: 'none' as const }}>(optional)</span></label>
                <input
                  type="text"
                  className="cal-input"
                  placeholder="e.g. Homemade, restaurant, post-workout..."
                  value={newMeal.note}
                  onChange={e => setNewMeal({ ...newMeal, note: e.target.value })}
                  onFocus={() => setShowDropdown(false)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, padding: '13px', background: saving ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 18px rgba(249,115,22,0.35)', transition: 'all .2s' }}
                  onMouseEnter={e => { if (!saving) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                  {saving ? 'Saving...' : 'Save Meal'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}