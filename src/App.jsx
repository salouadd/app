import { useEffect, useMemo, useState } from 'react';
import { defaultScenarios } from './data/scenarios.js';
import CheckIn from './components/CheckIn.jsx';
import ResultSummary from './components/ResultSummary.jsx';
import ScenarioBuilder from './components/ScenarioBuilder.jsx';
import Simulator from './components/Simulator.jsx';
import { createRun, getCurrentRunTime } from './lib/scenarioRun.js';

const STORAGE_KEYS = {
  customScenarios: 'decisionlab.customScenarios.v1',
  progress: 'decisionlab.progress.v1',
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Impossible de lire ${key} depuis le stockage local.`, error);
    return fallback;
  }
}

function initialRun() {
  if (new URLSearchParams(window.location.search).get('checkin') === '1') {
    return { screen: 'checkin', run: null };
  }
  const saved = readStorage(STORAGE_KEYS.progress, null);
  if (!saved || typeof saved !== 'object' || !saved.run?.participant ||
      !['simulation', 'results'].includes(saved.screen)) {
    return { screen: 'catalog', run: null };
  }
  const knownScenarioIds = new Set(defaultScenarios.map((scenario) => scenario.id));
  if (!Array.isArray(saved.run.scenarioIds) ||
      saved.run.scenarioIds.some((id) => !knownScenarioIds.has(id))) {
    return { screen: 'catalog', run: null };
  }
  return saved;
}

function IconMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>;
}

function ScenarioCard({ scenario, index }) {
  return (
    <article className="scenario-card">
      <div className="scenario-card-top">
        <span className={`domain-tag tag-${scenario.accent || 'cyan'}`}><span className="status-dot" />{scenario.domain}</span>
        <span className="scenario-index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <h3>{scenario.title}</h3>
      <p className="scenario-description">{scenario.description || scenario.objective}</p>
      <div className="scenario-objective"><span>OBJECTIF LOGIQUE</span><p>{scenario.objective}</p></div>
      <div className="scenario-card-footer">
        <div className="scenario-meta"><span>◈ {scenario.difficulty}</span><span>◷ {scenario.duration}</span><span>▤ {scenario.steps.length} étapes</span></div>
        <span className="scenario-open">{scenario.custom ? 'Local uniquement' : 'Inclus au parcours'} <span>✓</span></span>
      </div>
    </article>
  );
}

export default function App() {
  const [customScenarios, setCustomScenarios] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.customScenarios, []);
    return Array.isArray(stored) ? stored : [];
  });
  const [{ screen, run }, setSession] = useState(initialRun);
  const [activeTab, setActiveTab] = useState('catalog');
  const [organizerAuthorized, setOrganizerAuthorized] = useState(false);
  const [notice, setNotice] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const scenarios = useMemo(
    () => [...defaultScenarios, ...(organizerAuthorized ? customScenarios : [])],
    [customScenarios, organizerAuthorized],
  );
  const activeScenario = scenarios.find((scenario) => scenario.id === run?.scenarioId);
  const resultScenarios = (run?.scenarioIds || []).map((id) => scenarios.find((scenario) => scenario.id === id)).filter(Boolean);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.customScenarios, JSON.stringify(customScenarios));
    } catch (error) {
      console.error('Impossible d’enregistrer les scénarios dans le stockage local.', error);
      setNotice('Enregistrement impossible : le stockage local du navigateur est indisponible ou saturé.');
    }
  }, [customScenarios]);

  useEffect(() => {
    try {
      if (run) localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ screen, run }));
      else localStorage.removeItem(STORAGE_KEYS.progress);
    } catch (error) {
      console.error('Impossible d’enregistrer la progression dans le stockage local.', error);
      setNotice('Progression non sauvegardée : le stockage local du navigateur est indisponible ou saturé.');
    }
  }, [run, screen]);

  useEffect(() => {
    if (screen !== 'results' || !run?.participant) return undefined;
    let active = true;
    const sessionId = run?.participant?.sessionId;
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    fetch(`/api/leaderboard${query}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Le classement est indisponible.');
        return body.leaderboard;
      })
      .then((entries) => {
        if (active) setLeaderboard(entries);
      })
      .catch((error) => {
        console.error('Impossible de charger le classement.', error);
        if (active) setNotice('Le classement partagé est indisponible pour le moment.');
      });
    return () => { active = false; };
  }, [screen, run?.participant?.sessionId]);

  function startGroupCheckIn() {
    setNotice('');
    setSession({ screen: 'checkin', run: null });
    setActiveTab('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function registerParticipant(username) {
    const response = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Impossible de créer le check-in.');
    return { username: body.username, checkInId: body.checkInId, sessionId: body.sessionId };
  }

  function startParticipantRun(participant, activeSession) {
    const registeredParticipant = { ...participant, sessionId: activeSession.id };
    window.history.replaceState(null, '', window.location.pathname);
    setSession({
      screen: 'simulation',
      run: createRun(
        defaultScenarios,
        registeredParticipant,
        activeSession.startedAt,
        Date.parse(activeSession.serverNow) - Date.now(),
      ),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function returnToCatalog() {
    setSession({ screen: 'catalog', run: null });
    setActiveTab('catalog');
    if (new URLSearchParams(window.location.search).has('checkin')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function finishScenario(completedRun) {
    const startedAtMs = Date.parse(completedRun.startedAt);
    const elapsedMs = Number.isFinite(startedAtMs)
      ? Math.max(0, Date.parse(getCurrentRunTime(completedRun)) - startedAtMs)
      : 0;
    const resultRun = { ...completedRun, elapsedMs };
    const nextScenarioId = completedRun.scenarioIds[completedRun.scenarioIndex + 1];
    const nextScenario = scenarios.find((scenario) => scenario.id === nextScenarioId);
    if (nextScenario) {
      setSession({
        screen: 'simulation',
        run: {
          ...completedRun,
          scenarioId: nextScenario.id,
          scenarioIndex: completedRun.scenarioIndex + 1,
          stepId: nextScenario.steps[0].id,
          stepStartedAt: getCurrentRunTime(completedRun),
          pendingNext: null,
          pendingOptionId: null,
        },
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (completedRun.participant) {
      try {
        const response = await fetch('/api/results', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            checkInId: completedRun.participant.checkInId,
            sessionId: completedRun.participant.sessionId,
            scores: resultRun.scores,
            score: resultRun.accuracyScore,
            elapsedMs: resultRun.elapsedMs,
            scenarioIds: resultRun.scenarioIds,
            history: resultRun.history,
            decisionCount: resultRun.history.length,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Impossible d’enregistrer le résultat.');
      } catch (error) {
        console.error('Impossible d’enregistrer le résultat de la session.', error);
        setNotice(`Résultat non enregistré : ${error.message}`);
      }
    }
    setSession({ screen: 'results', run: resultRun });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function replay() {
    startGroupCheckIn();
  }

  function addScenario(scenario) {
    if (!organizerAuthorized) {
      setNotice('La création de scénarios est réservée à l’organisateur.');
      return;
    }
    setCustomScenarios((current) => [...current.filter((item) => item.id !== scenario.id && item.title !== scenario.title), scenario]);
    setNotice('');
  }

  function deleteScenario(id) {
    if (!organizerAuthorized) {
      setNotice('La modification de scénarios est réservée à l’organisateur.');
      return;
    }
    setCustomScenarios((current) => current.filter((scenario) => scenario.id !== id));
    setNotice('');
  }

  function handleOrganizerAuthorizationChange(authorized) {
    setOrganizerAuthorized(authorized);
    if (!authorized) setActiveTab('catalog');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); returnToCatalog(); }}>
          <IconMark /><span>DECISION<span className="brand-light">LAB</span></span><span className="brand-version">SIM / 01</span>
        </a>
        <nav className="main-nav" aria-label="Navigation principale">
          <button className={activeTab === 'catalog' ? 'nav-item active' : 'nav-item'} onClick={() => { returnToCatalog(); setActiveTab('catalog'); }}>Scénarios</button>
          {organizerAuthorized && <button className={activeTab === 'builder' ? 'nav-item active' : 'nav-item'} onClick={() => { setSession({ screen: 'catalog', run: null }); setActiveTab('builder'); }}>Créateur de scénario</button>}
        </nav>
        <div className="header-status"><span className="live-dot" /> CLASSEMENT PARTAGÉ</div>
      </header>

      {notice && <div className="storage-notice" role="alert">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}

      <div className="page-content">
        {activeTab === 'builder' && organizerAuthorized ? (
          <ScenarioBuilder scenarios={scenarios} onAddScenario={addScenario} onDeleteScenario={deleteScenario} onError={setNotice} />
        ) : screen === 'checkin' ? (
          <CheckIn
            scenarioCount={defaultScenarios.length}
            questionCount={defaultScenarios.reduce((total, scenario) => total + scenario.steps.length, 0)}
            onRegister={registerParticipant}
            onStart={startParticipantRun}
            onCancel={returnToCatalog}
            onOrganizerAuthorizationChange={handleOrganizerAuthorizationChange}
          />
        ) : screen === 'simulation' && activeScenario && run ? (
          <Simulator
            key={`${activeScenario.id}-${run.scenarioIndex}`}
            scenario={activeScenario}
            run={run}
            onRunChange={(nextRun) => setSession((current) => ({ ...current, run: nextRun }))}
            onFinish={(completedRun) => finishScenario(completedRun || run)}
            onExit={returnToCatalog}
          />
        ) : screen === 'results' && resultScenarios.length > 0 && run ? (
          <ResultSummary
            scenarios={resultScenarios}
            run={run}
            leaderboard={leaderboard}
            onReplay={replay}
            onCatalog={returnToCatalog}
          />
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <div className="eyebrow"><span className="live-dot" /> CENTRE DE SIMULATION DÉCISIONNELLE</div>
                <h1>La décision juste<br />se <span>prépare.</span></h1>
                <p>Des situations critiques. Des choix qui comptent. Entraînez votre jugement opérationnel dans un environnement sans risque.</p>
                <div className="hero-actions">
                  <button className="button button-primary" onClick={startGroupCheckIn}>Démarrer les scénarios <span>→</span></button>
                  <a className="button button-secondary" href="#scenarios">Explorer le catalogue <span>↓</span></a>
                </div>
                <span className="hero-caption">QR CHECK-IN · PARCOURS COMPLET · PODIUM</span>
              </div>
              <div className="hero-console" aria-label="Aperçu du tableau de bord DecisionLab">
                <div className="console-top"><span><i /> LIVE SIMULATION</span><span>SYS / DL-001</span></div>
                <div className="console-body">
                  <div className="console-kicker">INDICATEURS DE DÉCISION</div>
                  <div className="console-line"><span>SÉCURITÉ / CONTRÔLE</span><strong>82<span>%</span></strong></div><div className="console-meter"><i className="cyan-fill" style={{ width: '82%' }} /></div>
                  <div className="console-line"><span>DISPONIBILITÉ</span><strong>67<span>%</span></strong></div><div className="console-meter"><i className="green-fill" style={{ width: '67%' }} /></div>
                  <div className="console-line"><span>RIGUEUR LOGIQUE</span><strong>91<span>%</span></strong></div><div className="console-meter"><i className="amber-fill" style={{ width: '91%' }} /></div>
                  <div className="console-event"><span>▸</span> ARBITRAGE EN COURS <span className="console-time">00:42</span></div>
                </div>
                <div className="console-bottom"><span>DECISION ENGINE</span><span>● NOMINAL</span></div>
              </div>
              <div className="hero-grid-line" />
            </section>

            <section className="catalog-section" id="scenarios">
              <div className="catalog-heading">
                <div><div className="eyebrow"><span className="eyebrow-mark">01</span> PARCOURS D’ENTRAÎNEMENT</div><h2>Choisissez votre <span>mise en situation.</span></h2></div>
                <p>Le parcours complet enchaîne les {defaultScenarios.length} scénarios intégrés en un seul check-in et enregistre le score au podium.</p>
              </div>
              <div className="scenario-grid">
                {scenarios.map((scenario, index) => <ScenarioCard key={scenario.id} scenario={scenario} index={index} />)}
              </div>
            </section>

            <section className="method-strip">
              <div><span className="method-number">01</span><p><strong>Évaluez les signaux</strong><br />Séparez faits établis et hypothèses.</p></div>
              <span className="method-connector">→</span>
              <div><span className="method-number">02</span><p><strong>Arbitrez sous contrainte</strong><br />Chaque décision fait évoluer trois jauges.</p></div>
              <span className="method-connector">→</span>
              <div><span className="method-number">03</span><p><strong>Apprenez du débrief</strong><br />Comparez vos choix au chemin recommandé.</p></div>
            </section>
          </>
        )}
      </div>

      <footer className="site-footer"><span><IconMark /> DECISIONLAB <span className="footer-muted">— SIMULATEUR DE RAISONNEMENT OPÉRATIONNEL</span></span><span>QR CHECK-IN · CLASSEMENT PARTAGÉ</span></footer>
    </div>
  );
}
