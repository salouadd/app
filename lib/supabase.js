import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

let client;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.');
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function authorizeOrganizer(request, response) {
  const expected = process.env.ORGANIZER_CODE;
  if (!expected) {
    response.status(503).json({ error: 'Le code organisateur doit être configuré dans les variables Vercel.' });
    return false;
  }
  const provided = request.headers['x-organizer-code'];
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(typeof provided === 'string' ? provided : '');
  const matches = providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
  if (!matches) {
    response.status(401).json({ error: 'Code organisateur incorrect.' });
    return false;
  }
  return true;
}

export async function getActiveSession(database) {
  const { data: state, error: stateError } = await database
    .from('app_state')
    .select('session_id')
    .eq('id', 'current')
    .single();
  if (stateError) throw stateError;

  const { data: session, error: sessionError } = await database
    .from('quiz_sessions')
    .select('id, status, started_at, created_at')
    .eq('id', state.session_id)
    .single();
  if (sessionError) throw sessionError;
  return session;
}

export function sendServerError(response, message, error) {
  console.error(message, error);
  response.status(500).json({ error: 'Erreur serveur. Vérifiez la configuration Supabase.' });
}
