import { useRef, useState } from 'react';

const emptyStep = () => ({
  title: '',
  context: '',
  alert: '',
  constraint: '',
  options: [
    { label: '', consequence: '', bias: '', security: 0, availability: 0, logic: 0, recommended: true },
    { label: '', consequence: '', bias: '', security: 0, availability: 0, logic: 0, recommended: false },
    { label: '', consequence: '', bias: '', security: 0, availability: 0, logic: 0, recommended: false },
  ],
});

const initialForm = {
  title: '',
  domain: 'Architecture & continuité',
  difficulty: 'Intermédiaire',
  duration: '10 min',
  objective: '',
  description: '',
  steps: [emptyStep()],
};

function toScenario(form, existingId) {
  const slug = existingId ? existingId.replace(/^custom-/, '') : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: existingId || `custom-${slug}`,
    title: form.title.trim(),
    domain: form.domain.trim(),
    difficulty: form.difficulty,
    duration: form.duration.trim(),
    objective: form.objective.trim(),
    description: form.description.trim(),
    accent: 'cyan',
    custom: true,
    steps: form.steps.map((step, stepIndex) => ({
      id: `${slug}-step-${stepIndex + 1}`,
      title: step.title.trim(),
      context: step.context.trim(),
      alert: step.alert.trim() || 'Alerte opérationnelle à qualifier',
      constraint: step.constraint.trim() || 'Choisir une action proportionnée et vérifiable',
      options: step.options.map((option, optionIndex) => ({
        id: `${slug}-step-${stepIndex + 1}-choice-${optionIndex + 1}`,
        label: option.label.trim(),
        detail: `Impact : sécurité ${Number(option.security) >= 0 ? '+' : ''}${Number(option.security)}, disponibilité ${Number(option.availability) >= 0 ? '+' : ''}${Number(option.availability)}, logique ${Number(option.logic) >= 0 ? '+' : ''}${Number(option.logic)}.`,
        impact: {
          security: Number(option.security),
          availability: Number(option.availability),
          logic: Number(option.logic),
        },
        consequence: option.consequence.trim(),
        bias: option.bias.trim() || 'Point de vigilance : vérifier le périmètre et les effets de cette décision.',
        next: stepIndex < form.steps.length - 1 ? `${slug}-step-${stepIndex + 2}` : null,
        recommended: Boolean(option.recommended),
      })),
    })),
  };
}

function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps) || scenario.steps.length < 1) {
    throw new Error('Un scénario doit contenir au moins une étape.');
  }
  if (typeof scenario.title !== 'string' || !scenario.title.trim() ||
      typeof scenario.domain !== 'string' || !scenario.domain.trim() ||
      typeof scenario.objective !== 'string' || !scenario.objective.trim()) {
    throw new Error('Le titre, le domaine et l’objectif du scénario sont obligatoires.');
  }
  const stepIds = new Set(scenario.steps.map((step) => step.id));
  if (stepIds.size !== scenario.steps.length || scenario.steps.some((step) =>
    typeof step.id !== 'string' || !step.id || typeof step.title !== 'string' || !step.title.trim() ||
    typeof step.context !== 'string' || !step.context.trim() || !Array.isArray(step.options) ||
    step.options.length < 2 || step.options.length > 4)) {
    throw new Error('Chaque étape doit avoir un identifiant unique, un titre, un contexte et au moins deux choix.');
  }
  const stepStates = new Map();
  function visitStep(stepId) {
    const state = stepStates.get(stepId);
    if (state === 'visiting') throw new Error('Le scénario contient un embranchement circulaire.');
    if (state === 'visited') return;
    stepStates.set(stepId, 'visiting');
    const step = scenario.steps.find((item) => item.id === stepId);
    step.options.forEach((option) => {
      if (option.next) visitStep(option.next);
    });
    stepStates.set(stepId, 'visited');
  }
  visitStep(scenario.steps[0].id);
  if (stepStates.size !== scenario.steps.length) {
    throw new Error('Chaque étape doit pouvoir être atteinte depuis la première étape.');
  }
  scenario.steps.forEach((step) => {
    const recommended = step.options.filter((option) => option.recommended);
    if (recommended.length !== 1) throw new Error(`L’étape « ${step.title} » doit avoir exactement un choix recommandé.`);
    const optionIds = new Set(step.options.map((option) => option.id));
    if (optionIds.size !== step.options.length) throw new Error(`Les choix de l’étape « ${step.title} » doivent avoir des identifiants uniques.`);
    step.options.forEach((option) => {
      if (typeof option.id !== 'string' || !option.id || typeof option.label !== 'string' || !option.label.trim() ||
          typeof option.consequence !== 'string' || !option.consequence.trim() || !option.impact ||
          (option.next !== null && typeof option.next !== 'string')) {
        throw new Error(`Un choix de l’étape « ${step.title} » est incomplet.`);
      }
      if (option.next && !stepIds.has(option.next)) {
        throw new Error(`Le choix « ${option.label} » mène à une étape inexistante.`);
      }
      ['security', 'availability', 'logic'].forEach((key) => {
        if (typeof option.impact[key] !== 'number' || !Number.isFinite(option.impact[key]) || option.impact[key] < -100 || option.impact[key] > 100) {
          throw new Error(`Impact « ${key} » invalide pour « ${option.label} ».`);
        }
      });
    });
  });
  return scenario;
}

export default function ScenarioBuilder({ scenarios, onAddScenario, onDeleteScenario, onError }) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const importRef = useRef(null);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateStep(stepIndex, field, value) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => index === stepIndex ? { ...step, [field]: value } : step),
    }));
  }

  function updateOption(stepIndex, optionIndex, field, value) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => index !== stepIndex ? step : ({
        ...step,
        options: step.options.map((option, choiceIndex) => ({
          ...option,
          ...(choiceIndex === optionIndex ? { [field]: value } : {}),
          ...(field === 'recommended' && value ? { recommended: choiceIndex === optionIndex } : {}),
        })),
      })),
    }));
  }

  function addStep() {
    setForm((current) => ({ ...current, steps: [...current.steps, emptyStep()] }));
  }

  function removeStep(stepIndex) {
    setForm((current) => ({ ...current, steps: current.steps.filter((_, index) => index !== stepIndex) }));
  }

  function addChoice(stepIndex) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => index === stepIndex && step.options.length < 4
        ? { ...step, options: [...step.options, { label: '', consequence: '', bias: '', security: 0, availability: 0, logic: 0, recommended: false }] }
        : step),
    }));
  }

  function removeChoice(stepIndex, optionIndex) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => {
        if (index !== stepIndex || step.options.length <= 2) return step;
        const options = step.options.filter((_, choiceIndex) => choiceIndex !== optionIndex);
        if (!options.some((option) => option.recommended)) {
          return { ...step, options: options.map((option, index) => ({ ...option, recommended: index === 0 })) };
        }
        return { ...step, options };
      }),
    }));
  }

  function saveScenario(event) {
    event.preventDefault();
    setMessage('');
    try {
      const missing = !form.title.trim() || !form.objective.trim() || form.steps.some((step) =>
        !step.title.trim() || !step.context.trim() || step.options.some((option) => !option.label.trim() || !option.consequence.trim()));
      if (missing) throw new Error('Complétez le titre, l’objectif, le titre et le contexte de chaque étape, ainsi que le libellé et la conséquence de chaque choix.');
      const scenario = validateScenario(toScenario(form, editingId));
      onAddScenario(scenario);
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? 'Scénario mis à jour.' : 'Scénario enregistré et ajouté au catalogue.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editScenario(scenario) {
    setForm({
      title: scenario.title,
      domain: scenario.domain,
      difficulty: scenario.difficulty,
      duration: scenario.duration,
      objective: scenario.objective,
      description: scenario.description || '',
      steps: scenario.steps.map((step) => ({
        title: step.title,
        context: step.context,
        alert: step.alert || '',
        constraint: step.constraint || '',
        options: step.options.map((option) => ({
          label: option.label,
          consequence: option.consequence,
          bias: option.bias || '',
          security: option.impact.security,
          availability: option.impact.availability,
          logic: option.impact.logic,
          recommended: Boolean(option.recommended),
        })),
      })),
    });
    setEditingId(scenario.id);
    setMessage(`Modification de « ${scenario.title} ».`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setMessage('Modification annulée.');
  }

  function exportScenarios() {
    const customScenarios = scenarios.filter((scenario) => scenario.custom);
    const blob = new Blob([JSON.stringify(customScenarios, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'decisionlab-scenarios.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`${customScenarios.length} scénario(s) personnalisé(s) exporté(s).`);
  }

  async function importScenarios(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      if (incoming.length === 0) throw new Error('Le fichier ne contient aucun scénario.');
      const validated = incoming.map(validateScenario).map((scenario) => ({
        ...scenario,
        id: `custom-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        custom: true,
      }));
      validated.forEach(onAddScenario);
      setMessage(`${validated.length} scénario(s) importé(s) avec succès.`);
    } catch (error) {
      const message = `Import impossible : ${error.message}`;
      setMessage(message);
      onError(message);
    }
  }

  return (
    <div className="builder-view">
      <section className="builder-header">
        <div><div className="eyebrow"><span className="eyebrow-mark">LAB</span> ÉDITEUR LOCAL</div><h1>Créez vos <span>scénarios.</span></h1><p>Construisez un exercice de décision, enregistrez-le dans ce navigateur et partagez-le en JSON.</p></div>
        <div className="builder-toolbar">
          <button className="button button-secondary" onClick={exportScenarios}>Exporter JSON <span>↓</span></button>
          <button className="button button-secondary" onClick={() => importRef.current?.click()}>Importer JSON <span>↑</span></button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={importScenarios} />
        </div>
      </section>

      {message && <div className="builder-message" role="status">{message}</div>}

      <form className="builder-form" onSubmit={saveScenario}>
        <section className="builder-card">
          <div className="builder-section-title"><span>01</span><div><h2>Identité du scénario</h2><p>Donnez le contexte et l’objectif de l’exercice.</p></div></div>
          <div className="form-grid">
            <label className="field field-wide">Titre du scénario<input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex. Incident sur le réseau de production" required /></label>
            <label className="field">Domaine<input value={form.domain} onChange={(event) => updateField('domain', event.target.value)} placeholder="Ex. Réseaux & infrastructure" required /></label>
            <label className="field">Difficulté<select value={form.difficulty} onChange={(event) => updateField('difficulty', event.target.value)}><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option><option>Expert</option></select></label>
            <label className="field">Durée estimée<input value={form.duration} onChange={(event) => updateField('duration', event.target.value)} placeholder="10 min" /></label>
            <label className="field field-wide">Objectif logique<textarea rows="2" value={form.objective} onChange={(event) => updateField('objective', event.target.value)} placeholder="Quel arbitrage le participant doit-il apprendre à faire ?" required /></label>
            <label className="field field-wide">Briefing général<textarea rows="2" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Décrivez brièvement la mise en situation." /></label>
          </div>
        </section>

        {form.steps.map((step, stepIndex) => (
          <section className="builder-card step-editor" key={stepIndex}>
            <div className="builder-section-title">
              <span>{String(stepIndex + 1).padStart(2, '0')}</span>
              <div><h2>Étape {stepIndex + 1}</h2><p>À la suite de chaque choix, le simulateur passe à l’étape suivante.</p></div>
              {form.steps.length > 1 && <button className="text-button delete-button" type="button" onClick={() => removeStep(stepIndex)}>Retirer l’étape</button>}
            </div>
            <div className="form-grid">
              <label className="field field-wide">Titre<input value={step.title} onChange={(event) => updateStep(stepIndex, 'title', event.target.value)} placeholder="Ex. Qualifier l’incident" required /></label>
              <label className="field field-wide">Contexte opérationnel<textarea rows="3" value={step.context} onChange={(event) => updateStep(stepIndex, 'context', event.target.value)} placeholder="Que sait-on à cette étape ?" required /></label>
              <label className="field">Alerte système<input value={step.alert} onChange={(event) => updateStep(stepIndex, 'alert', event.target.value)} placeholder="Signal ou alerte" /></label>
              <label className="field">Contrainte<input value={step.constraint} onChange={(event) => updateStep(stepIndex, 'constraint', event.target.value)} placeholder="Temps, périmètre, ressources…" /></label>
            </div>
            <div className="choice-editor-heading"><h3>Actions possibles</h3><span>2 à 4 choix · impacts de −100 à +100</span></div>
            <div className="choice-editor-list">
              {step.options.map((option, optionIndex) => (
                <div className="choice-editor" key={optionIndex}>
                  <div className="choice-editor-top"><span>OPTION {String.fromCharCode(65 + optionIndex)}</span><label className="recommended-toggle"><input type="radio" name={`recommended-${stepIndex}`} checked={option.recommended} onChange={() => updateOption(stepIndex, optionIndex, 'recommended', true)} /> Chemin recommandé</label>{step.options.length > 2 && <button className="text-button delete-button" type="button" onClick={() => removeChoice(stepIndex, optionIndex)}>Supprimer</button>}</div>
                  <label className="field">Action proposée<input value={option.label} onChange={(event) => updateOption(stepIndex, optionIndex, 'label', event.target.value)} placeholder="Décrivez une décision" required /></label>
                  <label className="field">Conséquence immédiate<textarea rows="2" value={option.consequence} onChange={(event) => updateOption(stepIndex, optionIndex, 'consequence', event.target.value)} placeholder="Expliquez l’effet technique et logique." required /></label>
                  <label className="field">Biais évité ou commis<input value={option.bias} onChange={(event) => updateOption(stepIndex, optionIndex, 'bias', event.target.value)} placeholder="Ex. Biais évité : généraliser une alerte isolée." /></label>
                  <div className="impact-fields">
                    {[['security', 'Sécurité'], ['availability', 'Disponibilité'], ['logic', 'Logique']].map(([key, label]) => (
                      <label className="field" key={key}>{label}<input type="number" min="-100" max="100" value={option[key]} onChange={(event) => updateOption(stepIndex, optionIndex, key, event.target.value)} /></label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {step.options.length < 4 && <button className="add-choice-button" type="button" onClick={() => addChoice(stepIndex)}>＋ Ajouter un choix</button>}
          </section>
        ))}

        <div className="builder-actions">
          <button className="button button-secondary" type="button" onClick={addStep}>＋ Ajouter une étape</button>
          <div className="builder-submit-actions">
            {editingId && <button className="button button-secondary" type="button" onClick={cancelEdit}>Annuler</button>}
            <button className="button button-primary" type="submit">{editingId ? 'Mettre à jour le scénario' : 'Enregistrer le scénario'} <span>→</span></button>
          </div>
        </div>
      </form>

      <section className="saved-scenarios builder-card">
        <div className="builder-section-title"><span>02</span><div><h2>Scénarios personnalisés</h2><p>{scenarios.filter((scenario) => scenario.custom).length} scénario(s) enregistré(s) sur cet appareil.</p></div></div>
        {scenarios.filter((scenario) => scenario.custom).length === 0
          ? <p className="empty-scenarios">Vos scénarios créés ou importés apparaîtront ici.</p>
          : <ul>{scenarios.filter((scenario) => scenario.custom).map((scenario) => <li key={scenario.id}><span><strong>{scenario.title}</strong><small>{scenario.steps.length} étape(s) · {scenario.domain}</small></span><div className="saved-scenario-actions"><button className="text-button" onClick={() => editScenario(scenario)} type="button">Modifier</button><button className="text-button delete-button" onClick={() => onDeleteScenario(scenario.id)} type="button">Supprimer</button></div></li>)}</ul>}
      </section>
    </div>
  );
}
