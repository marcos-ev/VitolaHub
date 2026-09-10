import { useQuery } from '@tanstack/react-query';
import { AchievementProgress } from '@charuto/shared';
import { apiFetch } from '../client';

// GET /achievements/me
export function useMyAchievementsQuery() {
  return useQuery({
    queryKey: ['achievements', 'me'],
    queryFn: () => apiFetch<AchievementProgress[]>('/achievements/me'),
  });
}
