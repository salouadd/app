import { getSupabase, sendServerError } from '../lib/supabase.js';
import { validateProgress } from '../lib/validateRun.js';
import { defaultScenarios } from '../src/data/scenarios.js';

const metricKeys = ['security', 'availability', 'logic'];

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const { checkInId, sessionId, scores, score, elapsedMs, scenarioIds, history, decisionCount } = request.body || {};
  if (typeof checkInId !== 'string' || typeof sessionId !== 'string' ||
      !Array.isArray(scenarioIds) || !Array.isArray(history) ||
      !Number.isInteger(decisionCount) || decisionCount < 1 ||
      decisionCount !== history.length ||
      !Number.isInteger(score) || score < 0 || score > 100 ||
      !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 86400000 ||
      !scores || metricKeys.some((key) => !Number.isInteger(scores[key]) || scores[key] < 0 || scores[key] > 100)) {
    response.status(400).json({ error: 'Les données de progression sont incomplètes ou invalides.' });
    return;
  }

  const verification = validateProgress(scenarioIds, history, defaultScenarios);
  if (!verification.valid) {
    response.status(400).json({ error: verification.error });
    return;
  }
  if (metricKeys.some((key) => scores[key] !== verification.scores[key]) ||
      score !== verification.accuracyScore) {
    response.status(400).json({ error: 'Les scores ne correspondent pas aux réponses enregistrées.' });
    return;
  }

  try {
    const database = getSupabase();
    const { data: participant, error: participantError } = await database
      .from('check_ins')
      .select('id, session_id, username')
      .eq('id', checkInId)
      .single();
    if (participantError?.code === 'PGRST116') {
      response.status(404).json({ error: 'Check-in introuvable. Scannez de nouveau le QR code.' });
      return;
    }
    if (participantError) throw participantError;
    if (participant.session_id !== sessionId) {
      response.status(400).json({ error: 'Le check-in ne correspond pas à cette session.' });
      return;
    }

    const { data: session, error: sessionError } = await database
      .from('quiz_sessions')
      .select('status')
      .eq('id', participant.session_id)
      .single();
    if (sessionError) throw sessionError;
    if (session.status !== 'running') {
      response.status(409).json({ error: 'La session n’est pas ouverte.' });
      return;
    }

    const { error: progressError } = await database
      .from('quiz_progress')
      .upsert({
        check_in_id: participant.id,
        session_id: participant.session_id,
        username: participant.username,
        score: verification.accuracyScore,
        elapsed_ms: elapsedMs,
        scores: verification.scores,
        scenario_count: scenarioIds.length,
        decision_count: verification.mainQuestionCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'check_in_id' });
    if (progressError) throw progressError;

    response.status(200).json({
      username: participant.username,
      score: verification.accuracyScore,
      decisionCount: verification.mainQuestionCount,
    });
  } catch (error) {
    sendServerError(response, 'Échec d’enregistrement de la progression.', error);
  }
}
