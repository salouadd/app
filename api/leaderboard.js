import { getActiveSession, getSupabase, sendServerError } from '../lib/supabase.js';
import { compareLeaderboardEntries } from '../src/lib/scenarioRun.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  try {
    const database = getSupabase();
    const session = await getActiveSession(database);
    const requestedSessionId = typeof request.query?.sessionId === 'string' ? request.query.sessionId : session.id;
    const [resultsResponse, progressResponse] = await Promise.all([
      database
        .from('quiz_results')
        .select('check_in_id, username, score, elapsed_ms, scores, scenario_count, decision_count, created_at')
        .eq('session_id', requestedSessionId)
        .order('score', { ascending: false })
        .order('elapsed_ms', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(20),
      database
        .from('quiz_progress')
        .select('check_in_id, username, score, elapsed_ms, scores, scenario_count, decision_count, updated_at')
        .eq('session_id', requestedSessionId)
        .order('score', { ascending: false })
        .order('elapsed_ms', { ascending: true })
        .order('updated_at', { ascending: true })
        .limit(20),
    ]);
    if (resultsResponse.error) throw resultsResponse.error;
    if (progressResponse.error) throw progressResponse.error;
    const entriesByCheckIn = new Map(progressResponse.data.map((entry) => [entry.check_in_id, {
      username: entry.username,
      score: entry.score,
      elapsedMs: entry.elapsed_ms,
      scores: entry.scores,
      scenarioCount: entry.scenario_count,
      decisionCount: entry.decision_count,
      completedAt: entry.updated_at,
      status: 'en cours',
    }]));
    resultsResponse.data.forEach((entry) => {
      entriesByCheckIn.set(entry.check_in_id, {
        username: entry.username,
        score: entry.score,
        elapsedMs: entry.elapsed_ms,
        scores: entry.scores,
        scenarioCount: entry.scenario_count,
        decisionCount: entry.decision_count,
        completedAt: entry.created_at,
        status: 'terminé',
      });
    });
    response.status(200).json({
      leaderboard: Array.from(entriesByCheckIn.values())
        .sort(compareLeaderboardEntries)
        .slice(0, 20),
    });
  } catch (error) {
    sendServerError(response, 'Échec de chargement du classement.', error);
  }
}
