import { supabase } from './supabase';

/**
 * Récupère tous les user_ids membres du même restaurant que l'utilisateur.
 * Si l'utilisateur n'est dans aucun restaurant, retourne uniquement son propre id.
 */
export async function getRestaurantUserIds(userId: string): Promise<string[]> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('restaurant_id')
      .eq('id', userId)
      .single();

    if (!profile?.restaurant_id) return [userId];

    const { data: members } = await supabase
      .from('restaurant_members')
      .select('user_id')
      .eq('restaurant_id', profile.restaurant_id);

    if (!members || members.length === 0) return [userId];

    return members.map(m => m.user_id);
  } catch (err) {
    console.error('[getRestaurantUserIds]', err);
    return [userId];
  }
}
