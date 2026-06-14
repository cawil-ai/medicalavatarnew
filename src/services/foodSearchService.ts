import Papa from 'papaparse';

export interface FoodItem {
  id: string;
  name: string;
  altName?: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  source: string;
  defaultPieceWeight?: number;
}

const USDA_API_KEY = 'ZmQP69i0RlMRhocXcQsmoGCGdzdylkB1VhWO98bN';

let localCSVDataCache: FoodItem[] | null = null;

// Helper to load Local CSVs
async function loadAndCacheCSVs(): Promise<FoodItem[]> {
  if (localCSVDataCache) return localCSVDataCache;

  const files = [
    '/datasets/FOOD-DATA-GROUP1.csv',
    '/datasets/FOOD-DATA-GROUP2.csv',
    '/datasets/FOOD-DATA-GROUP3.csv',
    '/datasets/FOOD-DATA-GROUP4.csv',
    '/datasets/FOOD-DATA-GROUP5.csv'
  ];

  const allItems: FoodItem[] = [];

  for (const file of files) {
    try {
      const response = await fetch(file);
      if (!response.ok) continue;

      const text = await response.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

      for (const row of parsed.data as any[]) {
        if (row.food && row['Caloric Value']) {
          allItems.push({
            id: `local-${allItems.length}-${Math.random().toString(36).substr(2, 5)}`,
            name: row.food,
            caloriesPer100g: parseFloat(row['Caloric Value']),
            proteinPer100g: parseFloat(row['Protein']) || 0,
            carbsPer100g: parseFloat(row['Carbohydrates']) || 0,
            fatPer100g: parseFloat(row['Fat']) || 0,
            source: 'Local Archive'
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load local dataset:', file);
    }
  }

  localCSVDataCache = allItems;
  return allItems;
}

// 1. Search Local CSV
async function searchLocalCSV(query: string): Promise<FoodItem[]> {
  try {
    const data = await loadAndCacheCSVs();
    const q = query.toLowerCase();
    const qNoSpace = q.replace(/\s+/g, '');
    return data.filter(item => {
      const name = item.name.toLowerCase();
      const nameNoSpace = name.replace(/\s+/g, '');
      return name.includes(q) || nameNoSpace.includes(qNoSpace);
    }).slice(0, 10);
  } catch (e) {
    console.error('Local CSV search failed', e);
    return [];
  }
}

// 2. Search USDA API
async function searchUSDA(query: string): Promise<FoodItem[]> {
  try {
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&pageSize=10`);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.foods) return [];

    return data.foods.map((f: any) => {
      // Find the Energy nutrient (ID 1008 is Energy in kcal)
      const energyNutrient = f.foodNutrients.find((n: any) =>
        n.nutrientId === 1008 || (n.nutrientName?.toLowerCase().includes('energy') && n.unitName?.toUpperCase() === 'KCAL')
      );
      const proteinNutrient = f.foodNutrients.find((n: any) =>
        n.nutrientId === 1003 || n.nutrientName?.toLowerCase().includes('protein')
      );
      const carbsNutrient = f.foodNutrients.find((n: any) =>
        n.nutrientId === 1005 || n.nutrientName?.toLowerCase().includes('carbohydrate')
      );
      const fatNutrient = f.foodNutrients.find((n: any) =>
        n.nutrientId === 1004 || n.nutrientName?.toLowerCase().includes('lipid') || n.nutrientName?.toLowerCase().includes('fat')
      );

      let pieceWeight = 0;
      if (f.foodPortions && f.foodPortions.length > 0) {
        const portion = f.foodPortions.find((p: any) => p.modifier?.toLowerCase().includes('piece') || p.modifier?.toLowerCase().includes('slice') || p.amount === 1);
        if (portion && portion.gramWeight) {
          pieceWeight = portion.gramWeight;
        } else if (f.foodPortions[0].gramWeight) {
          pieceWeight = f.foodPortions[0].gramWeight;
        }
      }

      return {
        id: `usda-${f.fdcId}`,
        name: f.description,
        caloriesPer100g: energyNutrient ? energyNutrient.value : 0,
        proteinPer100g: proteinNutrient ? proteinNutrient.value : 0,
        carbsPer100g: carbsNutrient ? carbsNutrient.value : 0,
        fatPer100g: fatNutrient ? fatNutrient.value : 0,
        source: 'USDA API',
        defaultPieceWeight: pieceWeight > 0 ? pieceWeight : undefined
      };
    });
  } catch (e) {
    console.warn('USDA search failed', e);
    return [];
  }
}

// 3. Search DOST PH
// Now loads from local scraped CSV
let dostCache: FoodItem[] | null = null;

async function searchDOST(query: string): Promise<FoodItem[]> {
  try {
    if (!dostCache) {
      const res = await fetch('/datasets/DOST-FOODS.csv');
      if (res.ok) {
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

        dostCache = [];
        for (const row of parsed.data as any[]) {
          if (row.name && row.caloriesPer100g) {
            dostCache.push({
              id: row.id || `dost-${Math.random().toString(36).substr(2, 9)}`,
              name: row.name,
              altName: row.altName || '',
              caloriesPer100g: parseFloat(row.caloriesPer100g) || 0,
              proteinPer100g: parseFloat(row.proteinPer100g) || parseFloat(row.Protein) || 0,
              carbsPer100g: parseFloat(row.carbsPer100g) || parseFloat(row.Carbohydrates) || 0,
              fatPer100g: parseFloat(row.fatPer100g) || parseFloat(row.Fat) || 0,
              source: 'DOST PH'
            });
          }
        }
      } else {
        dostCache = [];
      }
    }

    const q = query.toLowerCase();
    const qNoSpace = q.replace(/\s+/g, '');
    return (dostCache || []).filter(item => {
      const name = item.name.toLowerCase();
      const nameNoSpace = name.replace(/\s+/g, '');
      const matchName = name.includes(q) || nameNoSpace.includes(qNoSpace);

      const matchAlt = item.altName ? (
        item.altName.toLowerCase().includes(q) ||
        item.altName.toLowerCase().replace(/\s+/g, '').includes(qNoSpace)
      ) : false;

      return matchName || matchAlt;
    }).slice(0, 10);
  } catch (e) {
    console.warn('DOST search failed', e);
    return [];
  }
}

const FILIPINO_RECIPES: Record<string, {name: string, weight: number}[]> = {
  'adobong baboy': [
    { name: 'pork belly', weight: 200 },
    { name: 'soy sauce', weight: 30 },
    { name: 'vinegar', weight: 30 },
    { name: 'garlic', weight: 10 },
    { name: 'oil', weight: 10 },
    { name: 'bay leaf', weight: 2 },
    { name: 'pepper', weight: 5 }
  ],
  'adobong manok': [
    { name: 'chicken breast', weight: 200 },
    { name: 'soy sauce', weight: 30 },
    { name: 'vinegar', weight: 30 },
    { name: 'garlic', weight: 10 },
    { name: 'oil', weight: 10 },
    { name: 'bay leaf', weight: 2 },
    { name: 'pepper', weight: 5 }
  ],
  'adobong tokwa': [
    { name: 'tofu', weight: 200 },
    { name: 'soy sauce', weight: 30 },
    { name: 'vinegar', weight: 30 },
    { name: 'garlic', weight: 10 },
    { name: 'oil', weight: 10 },
    { name: 'bay leaf', weight: 2 },
    { name: 'pepper', weight: 5 }
  ],
  'sinigang na baboy': [
    { name: 'pork belly', weight: 200 },
    { name: 'tamarind', weight: 50 },
    { name: 'eggplant', weight: 50 },
    { name: 'kangkong', weight: 50 },
    { name: 'tomato', weight: 50 },
    { name: 'radish', weight: 50 },
    { name: 'chili', weight: 10 },
    { name: 'water', weight: 1000 }
  ],
  'sinigang na manok': [
    { name: 'chicken breast', weight: 200 },
    { name: 'tamarind', weight: 50 },
    { name: 'eggplant', weight: 50 },
    { name: 'kangkong', weight: 50 },
    { name: 'tomato', weight: 50 },
    { name: 'radish', weight: 50 },
    { name: 'chili', weight: 10 },
    { name: 'water', weight: 1000 }
  ],
  'sinigang na hipon': [
    { name: 'shrimp', weight: 200 },
    { name: 'tamarind', weight: 50 },
    { name: 'eggplant', weight: 50 },
    { name: 'kangkong', weight: 50 },
    { name: 'tomato', weight: 50 },
    { name: 'radish', weight: 50 },
    { name: 'chili', weight: 10 },
    { name: 'water', weight: 1000 }
  ],
  'sinigang na bangus': [
    { name: 'milkfish', weight: 200 },
    { name: 'tamarind', weight: 50 },
    { name: 'eggplant', weight: 50 },
    { name: 'kangkong', weight: 50 },
    { name: 'tomato', weight: 50 },
    { name: 'radish', weight: 50 },
    { name: 'chili', weight: 10 },
    { name: 'water', weight: 1000 }
  ],
  'kare-kare': [
    { name: 'beef tripe', weight: 100 },
    { name: 'beef lean meat', weight: 100 },
    { name: 'peanut butter', weight: 50 },
    { name: 'eggplant', weight: 50 },
    { name: 'string bean', weight: 50 },
    { name: 'banana heart', weight: 50 },
    { name: 'pechay', weight: 50 },
    { name: 'shrimp paste', weight: 30 }
  ],
  'lechon kawali': [
    { name: 'pork belly', weight: 200 },
    { name: 'salt', weight: 10 },
    { name: 'pepper', weight: 5 },
    { name: 'bay leaf', weight: 2 },
    { name: 'oil', weight: 30 }
  ],
  'tinolang manok': [
    { name: 'chicken breast', weight: 200 },
    { name: 'chayote', weight: 100 },
    { name: 'ginger', weight: 20 },
    { name: 'onion', weight: 50 },
    { name: 'chili lvs', weight: 20 },
    { name: 'fish sauce', weight: 15 },
    { name: 'water', weight: 1000 }
  ],
  'bistek tagalog': [
    { name: 'beef lean meat', weight: 200 },
    { name: 'soy sauce', weight: 30 },
    { name: 'calamansi', weight: 15 },
    { name: 'onion', weight: 50 },
    { name: 'oil', weight: 15 },
    { name: 'sugar', weight: 5 },
    { name: 'water', weight: 50 }
  ],
  'dinuguan': [
    { name: 'pork belly', weight: 100 },
    { name: 'pork blood', weight: 100 },
    { name: 'pork intestine', weight: 100 },
    { name: 'vinegar', weight: 30 },
    { name: 'garlic', weight: 10 },
    { name: 'onion', weight: 50 },
    { name: 'chili', weight: 10 },
    { name: 'fish sauce', weight: 15 }
  ],
  'pinakbet': [
    { name: 'squash', weight: 100 },
    { name: 'eggplant', weight: 100 },
    { name: 'bitter melon', weight: 50 },
    { name: 'okra', weight: 50 },
    { name: 'string bean', weight: 50 },
    { name: 'pork, lean, boiled', weight: 50 },
    { name: 'shrimp paste', weight: 20 },
    { name: 'tomato', weight: 50 },
    { name: 'water', weight: 100 }
  ],
  'bulalo': [
    { name: 'beef shank', weight: 200 },
    { name: 'cabbage', weight: 100 },
    { name: 'corn', weight: 100 },
    { name: 'potato', weight: 100 },
    { name: 'chinese cabbage', weight: 50 }, // For bok choy
    { name: 'onion', weight: 50 },
    { name: 'pepper', weight: 5 },
    { name: 'fish sauce', weight: 15 }
  ],
  'sisig': [
    { name: 'pork belly', weight: 200 }, // Proxy for pig face/ears/belly
    { name: 'chicken liver', weight: 50 },
    { name: 'onion', weight: 30 },
    { name: 'calamansi', weight: 15 },
    { name: 'soy sauce', weight: 15 },
    { name: 'chili', weight: 10 },
    { name: 'mayonnaise', weight: 20 }
  ]
};

export async function searchAllFoods(query: string, skipRecipe = false): Promise<FoodItem[]> {
  if (!query || query.trim().length < 2) return [];

  let effectiveQuery = query;
  const qLower = query.toLowerCase().trim();

  if (!skipRecipe && FILIPINO_RECIPES[qLower]) {
    const recipe = FILIPINO_RECIPES[qLower];
    let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;
    let totalWeight = 0;
    
    for (const ing of recipe) {
      const res = await searchAllFoods(ing.name, true);
      if (res.length > 0) {
        const best = res[0];
        totalCals += (best.caloriesPer100g * ing.weight) / 100;
        totalP += ((best.proteinPer100g || 0) * ing.weight) / 100;
        totalC += ((best.carbsPer100g || 0) * ing.weight) / 100;
        totalF += ((best.fatPer100g || 0) * ing.weight) / 100;
        totalWeight += ing.weight;
      }
    }
    
    if (totalWeight > 0) {
      const factor = 100 / totalWeight;
      const finalFood: FoodItem = {
        id: 'recipe-' + qLower.replace(/\s+/g, '-'),
        name: query.charAt(0).toUpperCase() + query.slice(1) + ' (Synthesized Recipe)',
        caloriesPer100g: Math.round(totalCals * factor),
        proteinPer100g: Math.round((totalP * factor) * 10) / 10,
        carbsPer100g: Math.round((totalC * factor) * 10) / 10,
        fatPer100g: Math.round((totalF * factor) * 10) / 10,
        source: 'Cawil Recipe Engine'
      };
      return [finalFood];
    }
  }

  // Smart Aliases for generic terms to hit correct dataset accurately
  const ALIASES: Record<string, string> = {
    // Existing Base
    'rice': 'rice, well-milled, boiled',
    'white rice': 'rice, well-milled, boiled',
    'steamed white rice': 'rice, well-milled, boiled',
    'peanut butter': 'Peanut butter',
    'brown rice': 'rice, undermilled',
    'fried rice': 'rice, well-milled, fried',
    'egg': 'egg, chicken, whole',
    'chicken': 'chicken breast',
    'pork': 'pork chop',
    'beef': 'beef lean meat, boiled',
    'fish': 'milkfish',
    'milk': 'milk, cow',
    'bread': 'bread, white, loaf',
    'noodles': 'noodles, rice, boiled',
    'pancit': 'noodles, rice, boiled',
    'pancit bihon': 'noodles, rice, boiled',
    'potato': 'potato, sweet, boiled',
    'fries': 'french fries',
    'french fries': 'french fries',
    'pasta': 'spaghetti with meat sauce',
    'spaghetti': 'spaghetti with meat sauce',
    'cheese': 'cheddar cheese',
    'cereal': 'corn flakes',
    'kikiam': 'fish preparation, quekiam',
    'kwek-kwek': 'egg, quail, boiled',
    'kwek kwek': 'egg, quail, boiled',
    'tokneneng': 'egg, quail, boiled',
    'calamares': 'squid, boiled',
  };

  if (ALIASES[qLower]) {
    effectiveQuery = ALIASES[qLower];
  }

  // Fire all queries in parallel
  const [local, usda, dost] = await Promise.allSettled([
    searchLocalCSV(effectiveQuery),
    searchUSDA(effectiveQuery),
    searchDOST(effectiveQuery)
  ]);

  const results: FoodItem[] = [];

  if (dost.status === 'fulfilled') results.push(...dost.value);
  if (usda.status === 'fulfilled') results.push(...usda.value);
  // Only use local FOOD-DATA-GROUP if DOST and USDA yielded nothing
  if (results.length === 0 && local.status === 'fulfilled') {
    results.push(...local.value);
  }

  let validResults = results.filter(r => r.caloriesPer100g > 0);

  const q = query.toLowerCase().replace(/\s+/g, '');
  validResults.sort((a, b) => {
    const aName = a.name.toLowerCase().replace(/\s+/g, '');
    const bName = b.name.toLowerCase().replace(/\s+/g, '');
    const aAlt = a.altName ? a.altName.toLowerCase().replace(/\s+/g, '') : '';
    const bAlt = b.altName ? b.altName.toLowerCase().replace(/\s+/g, '') : '';

    const aExact = aName === q || aAlt === q;
    const bExact = bName === q || bAlt === q;

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    if (a.source !== 'USDA' && b.source === 'USDA') return -1;
    if (a.source === 'USDA' && b.source !== 'USDA') return 1;

    return 0;
  });

  return validResults.slice(0, 30);
}

const COMMON_PIECE_WEIGHTS: Record<string, number> = {
  // DOST Philippine Dataset Items
  'pandesal': 35,
  'pan de sal': 35,
  'pan de coco': 45,
  'pan de leche': 40,
  'monay': 60,
  'empanada': 70,
  'puto': 35,
  'biko': 80,
  'sapin-sapin': 80,
  'sapin': 80,
  'pie': 120,
  'hotdog': 50,
  'sausage': 75,
  'chicken wing': 40,
  'chicken leg': 110,
  'chicken drumstick': 110,
  'chicken thigh': 135,
  'chicken breast': 180,
  'pork chop': 150,
  'egg': 50,
  'chicken egg': 50,
  'burger patty': 100,
  'patty': 100,
  'hamburger': 100,
  'burger': 100,
  'taho': 200,
  'tahu': 200,
  'banana': 118,
  'apple': 150,
  'mango': 200,
  'pizza': 100,
  'slice pizza': 100,

  // Local Archive Dataset Items
  'bagel': 100,
  'croissant': 60,
  'muffin': 110,
  'donut': 50,
  'doughnut': 50,
  'pancake': 50,
  'waffle': 40,
  'biscuit': 15,
  'cookie': 15,
  'brownie': 50,
  'cracker': 5,
  'burrito': 200,
  'taco': 120,
  'meatball': 25,
  'nugget': 16,
  'orange': 130,

  // USDA API & General Fallbacks
  'lumpia': 30,
  'spring roll': 30,
  'siomai': 15,
  'dumpling': 15,
  'siopao': 120,
  'kwek kwek': 35,
  'kwek-kwek': 35,
  'tokneneng': 70,
  'fishball': 10,
  'squidball': 12,
  'kikiam': 15,
  'isaw': 25,
  'turon': 70,
  'banana cue': 90,
  'camote cue': 80,
  'ensaymada': 85,
  'spanish bread': 45,
  'hopia': 45,
  'kutsinta': 30,
  'longganisa': 45,
  'balut': 65,
  'penoy': 65,
  'slice of bread': 30,
  'bread': 30,
  'rice': 150
};

export async function parseFoodInput(input: string): Promise<{ name: string, cals: number, p: number, c: number, f: number }[]> {
  const items = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const parsedItems = [];

  for (const itemStr of items) {
    const match = itemStr.match(/^([\d.]+)\s*(cups|cup|tbsp|tsp|oz|g|ml|l|pcs|pc|pieces|piece|cans|can)?\s*(?:of\s+)?(.*)$/i);
    let amount = 1, unit = 'pc', foodName = itemStr;
    if (match) {
      amount = parseFloat(match[1]) || 1;
      unit = match[2] ? match[2].toLowerCase() : 'pc';
      foodName = match[3] || itemStr;
    }

    const results = await searchAllFoods(foodName);
    if (results.length > 0) {
      const bestMatch = results[0];
      const isPiece = (unit === 'pc' || unit === 'pcs' || unit === 'piece' || unit === 'pieces' || unit === 'can' || unit === 'cans');

      let pieceWeight = 100; // default fallback
      if (isPiece) {
        if (bestMatch.defaultPieceWeight) {
          pieceWeight = bestMatch.defaultPieceWeight;
        } else {
          const cleanedName = foodName.toLowerCase().trim();
          const matchName = bestMatch.name.toLowerCase();
          const matchAltName = bestMatch.altName ? bestMatch.altName.toLowerCase() : '';

          for (const [key, weight] of Object.entries(COMMON_PIECE_WEIGHTS)) {
            if (cleanedName.includes(key) || matchName.includes(key) || matchAltName.includes(key)) {
              pieceWeight = weight;
              break;
            }
          }
        }
      }

      const multiplier = (unit === 'cup' || unit === 'cups') ? 240 : unit === 'tbsp' ? 15 : unit === 'oz' ? 28.35 : unit === 'ml' ? 1 : unit === 'l' ? 1000 : isPiece ? pieceWeight : 1;
      parsedItems.push({
        name: itemStr,
        cals: Math.round((bestMatch.caloriesPer100g * amount * multiplier) / 100),
        p: Math.round(((bestMatch.proteinPer100g || 0) * amount * multiplier) / 100),
        c: Math.round(((bestMatch.carbsPer100g || 0) * amount * multiplier) / 100),
        f: Math.round(((bestMatch.fatPer100g || 0) * amount * multiplier) / 100)
      });
    } else {
      parsedItems.push({
        name: itemStr + " (Not found)", cals: 0, p: 0, c: 0, f: 0
      });
    }
  }
  return parsedItems;
}
