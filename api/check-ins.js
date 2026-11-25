import { getActiveSession, getSupabase, sendServerError } from '../lib/supabase.js';

const usernamePattern = /^[\p{L}\p{N}_.-]{3,24}$/u;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const username = typeof request.body?.username === 'string' ? request.body.username.trim() : '';
  if (!usernamePattern.test(username)) {
    response.status(400).json({ error: 'Le pseudo doit contenir 3 à 24 lettres, chiffres, points, tirets ou soulignés.' });
    return;
  }

  try {
    const database = getSupabase();
    const session = await getActiveSession(database);
    if (session.status !== 'waiting') {
      response.status(409).json({ error: 'Le quiz a déjà commencé. Demandez à l’organisateur de créer une nouvelle session.' });
      return;
    }
    const { data: participant, error } = await database
      .from('check_ins')
      .insert({ session_id: session.id, username })
      .select('id, username, session_id')
      .single();
    if (error?.code === '23505') {
      response.status(409).json({ error: 'Ce pseudo est déjà inscrit à cette session. Choisissez-en un autre.' });
      return;
    }
    if (error) throw error;
    response.status(201).json({
      checkInId: participant.id,
      sessionId: participant.session_id,
      username: participant.username,
    });
  } catch (error) {
    sendServerError(response, 'Échec de création du check-in.', error);
  }
}
