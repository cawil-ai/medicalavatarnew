import { useState, useEffect } from 'react';
import { FoodItem, searchAllFoods } from '../../services/foodSearchService';

export function useFoodSearch(delay = 400) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If the query is too short, clear the results
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const handler = setTimeout(async () => {
      try {
        const fetchedResults = await searchAllFoods(query);
        setResults(fetchedResults);
      } catch (err: any) {
        setError(err.message || 'Error searching for food.');
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [query, delay]);

  return { query, setQuery, results, setResults, isLoading, error };
}
