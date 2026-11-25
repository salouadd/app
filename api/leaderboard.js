import { getActiveSession, getSupabase, sendServerError } from '../lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  try {
    const database = getSupabase();
    const session = await getActiveSession(database);
    const requestedSessionId = typeof request.query?.sessionId === 'string' ? request.query.sessionId : session.id;
    const { data: results, error } = await database
      .from('quiz_results')
      .select('username, score, scores, scenario_count, decision_count, created_at')
      .eq('session_id', requestedSessionId)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw error;
    response.status(200).json({
      leaderboard: results.map((entry) => ({
        username: entry.username,
        score: entry.score,
        scores: entry.scores,
        scenarioCount: entry.scenario_count,
        decisionCount: entry.decision_count,
        completedAt: entry.created_at,
      })),
    });
  } catch (error) {
    sendServerError(response, 'Échec de chargement du classement.', error);
  }
}
