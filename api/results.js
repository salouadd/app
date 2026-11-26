import { getSupabase, sendServerError } from '../lib/supabase.js';
import { validateRun } from '../lib/validateRun.js';
import { defaultScenarios } from '../src/data/scenarios.js';

const metricKeys = ['security', 'availability', 'logic'];

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  const { checkInId, scores, score, elapsedMs, scenarioIds, history, decisionCount } = request.body || {};
  if (typeof checkInId !== 'string' || !Array.isArray(scenarioIds) ||
      scenarioIds.length < 1 || scenarioIds.length > 20 ||
      !scenarioIds.every((id) => typeof id === 'string') ||
      !Number.isInteger(decisionCount) || decisionCount < 1 || decisionCount > 500) {
    response.status(400).json({ error: 'Les données du résultat sont incomplètes ou invalides.' });
    return;
  }
  if (!Array.isArray(history) || decisionCount !== history.length) {
    response.status(400).json({ error: 'Le nombre de décisions ne correspond pas à l’historique.' });
    return;
  }
  if (!scores || metricKeys.some((key) => !Number.isInteger(scores[key]) || scores[key] < 0 || scores[key] > 100)) {
    response.status(400).json({ error: 'Les scores doivent être des nombres entiers compris entre 0 et 100.' });
    return;
  }
  if (!Number.isInteger(score) || score < 0 || score > 100 ||
      !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 86400000) {
    response.status(400).json({ error: 'Le score global ou le temps total est invalide.' });
    return;
  }
  const verification = validateRun(scenarioIds, history, defaultScenarios);
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
    if (request.body.sessionId && request.body.sessionId !== participant.session_id) {
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
      response.status(409).json({ error: 'La session n’est pas ouverte ou est déjà terminée.' });
      return;
    }

    const { error: resultError } = await database.from('quiz_results').insert({
      check_in_id: checkInId,
      session_id: participant.session_id,
      username: participant.username,
      score: verification.accuracyScore,
      elapsed_ms: elapsedMs,
      scores: verification.scores,
      scenario_count: scenarioIds.length,
      decision_count: verification.mainQuestionCount,
    });
    if (resultError?.code === '23505') {
      response.status(409).json({ error: 'Un résultat a déjà été enregistré pour ce check-in.' });
      return;
    }
    if (resultError) throw resultError;

    const { count: participantCount, error: countParticipantsError } = await database
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', participant.session_id);
    if (countParticipantsError) throw countParticipantsError;
    const { count: resultCount, error: countResultsError } = await database
      .from('quiz_results')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', participant.session_id);
    if (countResultsError) throw countResultsError;
    if (participantCount === resultCount) {
      const { error: completeError } = await database
        .from('quiz_sessions')
        .update({ status: 'completed' })
        .eq('id', participant.session_id)
        .eq('status', 'running');
      if (completeError) throw completeError;
    }

    response.status(201).json({ username: participant.username, score: verification.accuracyScore, elapsedMs });
  } catch (error) {
    sendServerError(response, 'Échec d’enregistrement du résultat.', error);
  }
}
