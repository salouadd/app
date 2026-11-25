import { randomUUID } from 'node:crypto';
import { authorizeOrganizer, getActiveSession, getSupabase, sendServerError } from '../lib/supabase.js';

export default async function handler(request, response) {
  try {
    const database = getSupabase();
    if (request.method === 'GET') {
      const session = await getActiveSession(database);
      response.status(200).json({
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.started_at,
          createdAt: session.created_at,
          serverNow: new Date().toISOString(),
        },
      });
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Méthode non autorisée.' });
      return;
    }
    if (!authorizeOrganizer(request, response)) return;

    const action = request.body?.action;
    if (action === 'status') {
      const session = await getActiveSession(database);
      const { data: participants, error } = await database
        .from('check_ins')
        .select('id, username, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      response.status(200).json({
        session: { id: session.id, status: session.status, startedAt: session.started_at, createdAt: session.created_at },
        participants: participants.map((participant) => ({
          id: participant.id,
          username: participant.username,
          joinedAt: participant.created_at,
        })),
      });
      return;
    }

    if (action === 'start') {
      const session = await getActiveSession(database);
      if (session.status !== 'waiting') {
        response.status(409).json({ error: 'Cette session n’est plus en attente.' });
        return;
      }
      const { data: participants, error: participantsError } = await database
        .from('check_ins')
        .select('id')
        .eq('session_id', session.id);
      if (participantsError) throw participantsError;
      if (participants.length === 0) {
        response.status(409).json({ error: 'Aucun participant n’a rejoint la salle d’attente.' });
        return;
      }
      const startedAt = new Date().toISOString();
      const { data: startedSession, error } = await database
        .from('quiz_sessions')
        .update({ status: 'running', started_at: startedAt })
        .eq('id', session.id)
        .eq('status', 'waiting')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!startedSession) {
        response.status(409).json({ error: 'Cette session vient d’être démarrée par un autre organisateur.' });
        return;
      }
      response.status(200).json({ session: { id: session.id, status: 'running', startedAt, serverNow: new Date().toISOString() } });
      return;
    }

    if (action === 'reset') {
      const { data: newSession, error: createError } = await database
        .from('quiz_sessions')
        .insert({ id: randomUUID(), status: 'waiting' })
        .select('id, status, started_at, created_at')
        .single();
      if (createError) throw createError;
      const { error: stateError } = await database
        .from('app_state')
        .update({ session_id: newSession.id })
        .eq('id', 'current');
      if (stateError) throw stateError;
      response.status(201).json({
        session: { id: newSession.id, status: newSession.status, startedAt: null, createdAt: newSession.created_at, serverNow: new Date().toISOString() },
      });
      return;
    }

    response.status(400).json({ error: 'Action organisateur inconnue.' });
  } catch (error) {
    sendServerError(response, 'Échec de l’API de session.', error);
  }
}
