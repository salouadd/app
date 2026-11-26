function answer(id, label, detail, consequence, bias, recommended, impact) {
  return {
    id,
    label,
    detail,
    consequence,
    bias,
    impact: impact || (recommended
      ? { security: 10, availability: 8, logic: 10 }
      : { security: -10, availability: -6, logic: -8 }),
    recommended,
  };
}

function question(id, title, context, alert, constraint, options, routeLabel = null) {
  return { id, title, context, alert, constraint, options, routeLabel };
}

function scenario({ id, title, domain, difficulty, duration, objective, description, accent, steps, questionCount }) {
  return {
    id,
    title,
    domain,
    difficulty,
    duration,
    objective,
    description,
    accent,
    questionCount: questionCount ?? steps.length,
    steps: steps.map((step, index) => ({
      ...step,
      options: step.options.map((option) => ({
        ...option,
        next: option.next !== undefined ? option.next : steps[index + 1]?.id ?? null,
      })),
    })),
  };
}

export const defaultScenarios = [
  scenario({
    id: 'zero-trust-onboarding',
    title: 'Du réseau plat au Zero Trust',
    domain: '802.1X · RADIUS · VLAN 10/11',
    difficulty: 'Avancé',
    duration: '12 min',
    objective: 'Contrôler l’accès dès le port réseau et n’autoriser que les identités et équipements conformes.',
    description: 'Un port non contrôlé du réseau plat VLAN 10 a laissé apparaître un équipement inconnu. Concevoir une réponse défensive fondée sur 802.1X et des politiques RADIUS.',
    accent: 'cyan',
    steps: [
      question(
        'zt-diagnose',
        'Qualifier l’accès non autorisé',
        'Un équipement inconnu est apparu sur un port libre du switch. Les journaux indiquent une attribution DHCP et un service web de test visible sur le segment. Évite de reproduire l’accès : il faut établir le périmètre à partir des traces disponibles.',
        'Port d’accès sans authentification · segment partagé',
        'Confirmer les faits avant toute modification large',
        [
          answer('zt-correlate', 'Corréler port, adresse MAC, bail DHCP et événements NAC, puis contenir ce seul port', 'Les journaux du switch, DHCP et NAC donnent une chronologie défensive.', 'Le point d’entrée est isolé sans perturber les équipements légitimes du VLAN.', 'Biais évité : modifier tout le réseau à partir d’un seul signal.', true),
          answer('zt-disable-vlan', 'Désactiver immédiatement tout le VLAN 10', 'La mesure est large alors que le périmètre observé est un seul port.', 'La disponibilité du segment est interrompue sans résoudre la cause du défaut de contrôle.', 'Biais commis : confondre ampleur de la mesure et précision.', false, { security: 12, availability: -24, logic: -12 }),
          answer('zt-ignore', 'Conserver le port ouvert car aucune panne utilisateur n’est signalée', 'L’absence de plainte ne démontre pas que l’équipement est autorisé.', 'L’accès inconnu reste possible et les traces ne sont pas exploitées.', 'Biais commis : prendre l’absence d’impact visible pour une preuve de sûreté.', false, { security: -20, availability: 2, logic: -12 }),
        ],
      ),
      question(
        'zt-port-control',
        'Choisir le contrôle avant attribution réseau',
        'Le switch apprend une adresse MAC dès qu’un équipement se connecte. L’objectif est de demander une authentification avant d’accorder un accès de production. Le filtrage MAC seul ne prouve pas l’identité et peut être usurpé.',
        'Aucune authentification de port · accès avant attribution contrôlée',
        'Choisir un mécanisme maintenable avec validation du serveur RADIUS',
        [
          answer('zt-dot1x', 'Déployer 802.1X avec une méthode EAP validée et certificats serveur vérifiés', 'Le port attend la décision RADIUS avant d’accorder l’accès prévu par la politique.', 'L’authentification est liée à une identité et l’échange protège contre un serveur d’authentification non vérifié.', 'Biais évité : confondre une adresse matérielle avec une identité.', true),
          answer('zt-mac-filter', 'S’appuyer uniquement sur une liste d’adresses MAC autorisées', 'La liste est simple à démarrer, mais ne fournit pas une authentification forte.', 'Une adresse copiée peut contourner le contrôle et la gestion manuelle devient fragile.', 'Biais commis : assimiler identifiant observable et preuve d’identité.', false, { security: -12, availability: 3, logic: -9 }),
          answer('zt-open-fallback', 'Autoriser tout port si le serveur RADIUS ne répond pas', 'Ce comportement de secours transforme une panne de contrôle en accès ouvert.', 'Le service paraît disponible, mais les équipements inconnus peuvent rejoindre le réseau.', 'Biais commis : privilégier la disponibilité sans borner le mode dégradé.', false, { security: -24, availability: 14, logic: -14 }),
        ],
      ),
      question(
        'zt-radius-policy',
        'Définir la décision RADIUS',
        'La politique doit distinguer un compte employé vérifié, tel que `employee@test.local`, d’un équipement inconnu. Le VLAN 11 est réservé à la production ; les demandes non reconnues ne doivent pas y accéder.',
        'Access-Accept / Access-Reject · attribution de rôle à vérifier',
        'Ne pas faire confiance au seul nom d’utilisateur ou à la seule adresse MAC',
        [
          answer('zt-role-policy', 'Accorder VLAN 11 uniquement après authentification et conformité ; refuser ou isoler les inconnus', 'Associer Access-Accept à une politique de rôle explicite et Access-Reject à un refus ou segment de remédiation.', 'L’employé vérifié reçoit l’accès attendu ; l’équipement non reconnu reste hors production.', 'Biais évité : accorder un accès de production par défaut.', true),
          answer('zt-vlan-any', 'Placer toute authentification réussie dans VLAN 11 sans contrôler le rôle', 'L’authentification est utile, mais la politique ne distingue pas les besoins d’accès.', 'Un compte valide peut recevoir une portée réseau supérieure à celle nécessaire.', 'Biais commis : confondre identité authentifiée et autorisation universelle.', false, { security: -12, availability: 5, logic: -8 }),
          answer('zt-mac-accept', 'Envoyer Access-Accept pour toute adresse MAC connue', 'Une adresse MAC n’est ni secrète ni une preuve suffisante de l’utilisateur.', 'La décision RADIUS paraît simple mais l’accès reste contournable.', 'Biais commis : baser la confiance sur un attribut facilement copiable.', false, { security: -18, availability: 3, logic: -11 }),
        ],
      ),
      question(
        'zt-validate',
        'Valider le déploiement Zero Trust',
        'La nouvelle politique est prête en préproduction. Il faut vérifier le parcours employé, le refus d’un équipement inconnu, la journalisation et le retour arrière avant généralisation.',
        'Politique configurée · validation et supervision requises',
        'Déployer par étapes et garder une procédure de retour arrière',
        [
          answer('zt-staged-test', 'Tester identités autorisées et refusées sur un port pilote, puis étendre avec suivi', 'Vérifier la décision RADIUS, le VLAN attribué et les journaux sans exposer la production.', 'Les erreurs de politique sont détectées avant un déploiement global.', 'Biais évité : supposer qu’une configuration correcte sur papier fonctionnera partout.', true),
          answer('zt-all-at-once', 'Appliquer partout immédiatement sans fenêtre de test', 'Une erreur de certificat ou de politique peut bloquer de nombreux ports.', 'Le changement est difficile à diagnostiquer et à annuler sous pression.', 'Biais commis : sacrifier la réversibilité pour gagner du temps.', false, { security: 1, availability: -18, logic: -14 }),
          answer('zt-no-logs', 'Désactiver les journaux pour réduire le volume pendant le déploiement', 'Sans événements d’authentification, les refus et erreurs deviennent difficiles à différencier.', 'Les incidents de déploiement et les accès anormaux perdent leur traçabilité.', 'Biais commis : optimiser le bruit au détriment de la capacité de contrôle.', false, { security: -11, availability: 0, logic: -14 }),
        ],
      ),
    ],
  }),
  scenario({
    id: 'nac-survival',
    title: 'SPOF : mode survie NAC',
    domain: 'PCA · FreeRADIUS · VLAN 99',
    difficulty: 'Expert',
    duration: '14 min',
    objective: 'Maintenir les sessions établies et traiter les nouvelles authentifications en mode dégradé sans fail-open global.',
    description: 'À 08 h 30, PacketFence sur DC1 devient injoignable. Arbitrer entre continuité des sessions, authentification locale de secours et Critical VLAN.',
    accent: 'emerald',
    questionCount: 4,
    steps: [
      question(
        'survival-existing',
        'Protéger les sessions déjà établies',
        'Le serveur NAC central `192.168.100.11` ne répond plus. Des employés déjà authentifiés sont connectés à `SW-NAC-01` sur le VLAN 11, tandis que les nouvelles demandes d’accès commencent à expirer.',
        'DC1 indisponible · sessions actives encore fonctionnelles',
        'Éviter une coupure globale sans élargir les autorisations',
        [
          answer('survival-keep-sessions', 'Maintenir les sessions et le VLAN 11 existants, puis vérifier leur état et leur périmètre', 'Le plan de données continue ; la panne du contrôleur ne justifie pas de déconnecter les sessions saines.', 'Les activités en cours sont préservées pendant le diagnostic du plan de contrôle.', 'Biais évité : traiter les connexions établies comme des demandes nouvelles.', true),
          { ...answer('survival-drop-all', 'Couper toutes les sessions pour forcer une réauthentification', 'Le service RADIUS indisponible empêcherait ensuite plusieurs reconnexions.', 'La mesure augmente les pertes de service et ne rétablit pas le contrôle central.', 'Biais commis : appliquer un redémarrage global sans plan de reprise.', false, { security: 7, availability: -24, logic: -10 }), next: 'survival-branch-response' },
          { ...answer('survival-open-all', 'Basculer tous les ports en accès ouvert', 'Cette action évite certains refus mais supprime le contrôle d’admission.', 'Le mode dégradé devient une ouverture durable potentielle.', 'Biais commis : masquer l’indisponibilité en supprimant la protection.', false, { security: -24, availability: 15, logic: -15 }), next: 'survival-branch-response' },
        ],
      ),
      question(
        'survival-auth',
        'Traiter les nouvelles authentifications',
        'Les nouvelles demandes subissent des timeouts RADIUS. `hostapd` peut utiliser une instance FreeRADIUS locale préconfigurée sur `127.0.0.1`, avec un jeu de politiques limité et auditable.',
        'Timeout RADIUS distant · service local de secours disponible',
        'Éviter à la fois fail-open total et fail-close général',
        [
          { ...answer('survival-local-radius', 'Valider la santé et les politiques de FreeRADIUS local, puis activer le basculement prévu', 'La décision s’appuie sur un secours testé et sur des règles limitées aux identités et services nécessaires.', 'Les nouvelles authentifications peuvent continuer avec des contrôles cohérents en mode dégradé.', 'Biais évité : improviser une exception globale pendant une panne.', true), next: 'survival-critical-vlan' },
          { ...answer('survival-fail-open', 'Accepter toute demande après expiration du délai RADIUS', 'Le timeout n’est pas une preuve d’identité ou de conformité.', 'Des équipements inconnus peuvent être admis sans contrôle.', 'Biais commis : assimiler indisponibilité du contrôle à une autorisation.', false, { security: -25, availability: 16, logic: -16 }), next: 'survival-critical-vlan' },
          { ...answer('survival-fail-close', 'Refuser toute nouvelle connexion et toute reprise de session', 'Le refus protège le périmètre mais ignore le mécanisme de continuité préparé.', 'Les nouveaux arrivants légitimes sont bloqués malgré un secours disponible.', 'Biais commis : appliquer le refus maximal sans distinguer le risque et le service.', false, { security: 14, availability: -22, logic: -10 }), next: 'survival-critical-vlan' },
        ],
      ),
      question(
        'survival-branch-response',
        'Réagir à l’impact de votre première décision',
        'La coupure générale interrompt des sessions métier, ou l’ouverture globale laisse des ports sans contrôle. Il faut maintenant limiter les effets de cette décision sans improviser une nouvelle bascule générale.',
        'Mode dégradé instable · impact métier ou exposition accrue',
        'Rétablir un périmètre contrôlé avant de poursuivre le secours',
        [
          answer('survival-restore-boundaries', 'Réduire le périmètre touché, vérifier les sessions et journaliser chaque réadmission', 'La reprise est ciblée et contrôlable ; les accès sont restaurés après vérification.', 'Le service revient progressivement sans conserver une ouverture globale ni répéter la coupure.', 'Biais évité : corriger une mesure excessive par une autre action générale.', true, { security: 11, availability: 7, logic: 10 }),
          answer('survival-leave-exception', 'Conserver le mode actuel jusqu’au retour du serveur central', 'Aucune limite ni échéance ne protège contre la persistance du mode dégradé.', 'La coupure ou l’ouverture excessive se prolonge pendant toute l’indisponibilité.', 'Biais commis : transformer une mesure temporaire en état durable.', false, { security: -16, availability: -10, logic: -13 }),
          answer('survival-reset-again', 'Redémarrer tous les équipements avant de vérifier les journaux', 'Un redémarrage supplémentaire efface des indices et peut étendre l’incident.', 'Le périmètre de l’incident devient plus difficile à établir et la disponibilité baisse encore.', 'Biais commis : agir avant de mesurer les conséquences de la première action.', false, { security: -8, availability: -17, logic: -18 }),
        ],
        'CHEMIN ALTERNATIF · IMPACT À CORRIGER',
      ),
      question(
        'survival-critical-vlan',
        'Limiter l’accès de survie',
        'Les politiques de secours sont confirmées. Les équipements sans authentification centrale complète doivent être limités aux services indispensables pendant l’incident.',
        'Mode local actif · Critical VLAN 99 disponible',
        'Définir précisément les flux autorisés et journaliser les admissions',
        [
          answer('survival-vlan99', 'Placer les cas prévus en VLAN 99 avec règles minimales et traçabilité', 'Le hook de politique Open vSwitch déjà validé applique le segment de survie aux seuls ports concernés.', 'Les besoins essentiels sont maintenus sans accorder un accès général au VLAN 11.', 'Biais évité : transformer le réseau de secours en réseau de production bis.', true),
          answer('survival-vlan11', 'Placer tous les nouveaux appareils en VLAN 11', 'Le VLAN de production est plus accessible, mais le contrôle de secours ne l’autorise pas.', 'La panne centrale élargit la confiance à des équipements non vérifiés.', 'Biais commis : utiliser le segment métier comme réponse universelle.', false, { security: -17, availability: 11, logic: -12 }),
          answer('survival-isolate', 'Bloquer tous les nouveaux appareils même lorsque le besoin est critique', 'Le risque est réduit, mais aucun processus gradué n’est appliqué.', 'Les activités prioritaires restent indisponibles alors qu’un segment contrôlé existe.', 'Biais commis : confondre isolement et continuité maîtrisée.', false, { security: 10, availability: -18, logic: -8 }),
        ],
      ),
      question(
        'survival-failback',
        'Préparer le retour au contrôleur central',
        'DC1 revient en ligne. Il faut vérifier la réplication des politiques et des journaux, puis sortir progressivement les ports du mode de survie.',
        'DC1 rétabli · état de cohérence à confirmer',
        'Éviter un basculement retour non testé ou simultané pour tous les ports',
        [
          answer('survival-staged-failback', 'Comparer les politiques, tester quelques ports, puis réauthentifier par vagues', 'Le retour au chemin central est progressif et chaque étape est mesurée.', 'Le VLAN 99 est retiré après validation du contrôle central et des services métier.', 'Biais évité : considérer le retour du serveur comme preuve de cohérence complète.', true),
          answer('survival-immediate', 'Forcer le retour de tous les ports en même temps', 'Une incohérence de réplication peut provoquer une vague de refus ou de bascules.', 'Le risque de panne secondaire augmente et complique l’attribution des erreurs.', 'Biais commis : confondre disponibilité du serveur et préparation du failback.', false, { security: 1, availability: -16, logic: -13 }),
          answer('survival-permanent', 'Laisser le mode local et le VLAN 99 actifs sans échéance', 'Le mode de survie n’est ni revu ni limité dans le temps.', 'Les exceptions deviennent permanentes et la politique centrale perd sa maîtrise.', 'Biais commis : oublier la sortie de crise après la reprise.', false, { security: -12, availability: 4, logic: -14 }),
        ],
      ),
    ],
  }),
  scenario({
    id: 'insider-coa',
    title: 'Menace interne : riposte ciblée',
    domain: 'RADIUS CoA · RFC 5176 · VLAN 666',
    difficulty: 'Expert',
    duration: '14 min',
    objective: 'Révoquer une session compromise de façon ciblée, préserver les preuves et vérifier la quarantaine.',
    description: 'Un poste employé déjà authentifié manifeste un comportement latéral suspect. Utiliser une réponse d’accès dynamique sans couper les autres employés.',
    accent: 'amber',
    steps: [
      question(
        'coa-qualify',
        'Qualifier le signal et son périmètre',
        'Le poste `00:0c:29:02:d3:16`, authentifié en VLAN 11, déclenche des alertes de connexions latérales inhabituelles. Les autres équipements ne montrent pas le même signal.',
        'Session active · identité initialement légitime · activité à confirmer',
        'Corréler les alertes et contenir seulement le périmètre confirmé',
        [
          answer('coa-correlate', 'Corréler identité, port `ens34`, événements NAC et télémétrie avant action ciblée', 'Les signaux indépendants confirment l’équipement et la session concernés.', 'La réponse peut viser un poste sans isoler les employés non impliqués.', 'Biais évité : transformer une alerte en preuve sans corroboration.', true),
          answer('coa-isolate-vlan', 'Couper immédiatement tout le VLAN 11', 'L’alerte concerne un poste mais la mesure affecte toute la production.', 'La disponibilité est fortement réduite sans améliorer la précision de l’enquête.', 'Biais commis : confondre périmètre du signal et périmètre de la mesure.', false, { security: 12, availability: -25, logic: -9 }),
          answer('coa-ignore', 'Ne rien faire puisque 802.1X a déjà authentifié l’utilisateur', 'L’authentification initiale correspond à l’état au temps t0 et ne garantit pas la session actuelle.', 'Un poste compromis conserve son accès interne pendant l’analyse.', 'Biais commis : confondre identité valide et comportement toujours sûr.', false, { security: -22, availability: 2, logic: -14 }),
        ],
      ),
      question(
        'coa-disconnect',
        'Choisir la révocation de session',
        'Le poste est identifié et la session est active. La plateforme NAC prend en charge les messages RADIUS CoA/Disconnect de la RFC 5176 sur UDP 3799.',
        'Session suspecte confirmée · autres sessions normales',
        'S’assurer que la demande vise la session exacte et que son résultat sera vérifié',
        [
          answer('coa-targeted-disconnect', 'Envoyer une demande Disconnect ciblée via le mécanisme NAC et vérifier l’accusé de réception', 'Le contrôleur utilise le flux CoA/Disconnect prévu et confirme la session visée.', 'La révocation à chaud cible le poste sans débrancher les autres utilisateurs.', 'Biais évité : remplacer une révocation précise par une coupure physique ou globale.', true),
          answer('coa-revoke-account-only', 'Réinitialiser le mot de passe sans révoquer la session active', 'Une modification de compte ne met pas forcément fin à une session déjà autorisée.', 'Le poste peut conserver temporairement son accès réseau.', 'Biais commis : traiter l’identité sans contenir l’équipement.', false, { security: -8, availability: 2, logic: -10 }),
          answer('coa-reboot-switch', 'Redémarrer le switch pour interrompre toutes les sessions', 'L’action dépasse largement le périmètre confirmé.', 'Les utilisateurs sains subissent une interruption évitable et les preuves peuvent être perdues.', 'Biais commis : privilégier une action visible à une réponse ciblée.', false, { security: 5, availability: -25, logic: -15 }),
        ],
      ),
      question(
        'coa-quarantine',
        'Vérifier l’isolement effectif',
        'La réponse dynamique est acceptée. La politique Open vSwitch doit placer `ens34` en VLAN 666, avec refus des accès internes et conservation des journaux.',
        'Disconnect-ACK reçu · quarantaine attendue sur VLAN 666',
        'Vérifier l’état réel du port et les flux bloqués, pas seulement l’accusé',
        [
          answer('coa-verify-vlan', 'Confirmer l’affectation au VLAN 666 et la perte d’accès interne pour ce seul port', 'Les journaux de décision et la télémétrie réseau confirment le résultat attendu.', 'La quarantaine est validée sans supposer que l’accusé garantit à lui seul l’application de la politique.', 'Biais évité : confondre commande acceptée et effet vérifié.', true),
          answer('coa-trust-ack', 'Clore l’alerte dès réception du Disconnect-ACK', 'L’accusé confirme le traitement de la demande, pas nécessairement l’état final de chaque flux.', 'Une erreur de rattachement ou de politique peut laisser l’accès actif.', 'Biais commis : prendre un événement de contrôle pour une preuve de résultat.', false, { security: -12, availability: 2, logic: -13 }),
          answer('coa-quarantine-all', 'Placer tout le VLAN 11 en quarantaine', 'La réponse dépasse la session confirmée.', 'La production entière perd sa connectivité interne sans nécessité démontrée.', 'Biais commis : étendre automatiquement une mesure ciblée.', false, { security: 6, availability: -23, logic: -10 }),
        ],
      ),
      question(
        'coa-recover',
        'Préserver les preuves et planifier la remise en service',
        'Le poste est confiné. L’équipe doit conserver les journaux et confirmer la remédiation avant de réauthentifier l’équipement.',
        'Accès interne bloqué · investigation et remédiation en cours',
        'La sortie de quarantaine doit être autorisée et vérifiable',
        [
          answer('coa-evidence-recovery', 'Préserver les traces, remédier, valider la posture puis réauthentifier sous surveillance', 'Documenter les décisions et définir des critères de sortie de quarantaine.', 'L’accès revient seulement lorsque la cause est traitée et la conformité confirmée.', 'Biais évité : assimiler une période de quarantaine à une remédiation.', true),
          answer('coa-release-now', 'Lever immédiatement la quarantaine à la demande du métier', 'La demande de disponibilité ne fournit pas de preuve de correction.', 'Le comportement suspect peut reprendre sur le réseau interne.', 'Biais commis : sacrifier les contrôles de sortie sous pression.', false, { security: -18, availability: 9, logic: -12 }),
          answer('coa-wipe', 'Effacer immédiatement le poste sans préserver les journaux', 'Le nettoyage peut supprimer des éléments utiles pour comprendre l’incident.', 'La cause et le périmètre risquent de rester inconnus.', 'Biais commis : nettoyer avant de documenter et comprendre.', false, { security: -2, availability: -9, logic: -15 }),
        ],
      ),
    ],
  }),
  scenario({
    id: 'iso-governance',
    title: 'Gouvernance ISO 22301 et failback',
    domain: 'PCA/PRA · RTO · RPO',
    difficulty: 'Avancé',
    duration: '12 min',
    objective: 'Vérifier les objectifs de reprise et organiser un retour à la normale contrôlé, mesurable et adapté au budget.',
    description: 'DC1 est rétabli après un incident majeur. Piloter la reprise du service NAC, les journaux de secours et le choix d’architecture.',
    accent: 'emerald',
    steps: [
      question(
        'iso-objectives',
        'Valider les objectifs de reprise',
        'Le PCA annonce un RTO inférieur à une minute grâce au basculement local et un RPO de zéro grâce à la réplication. Ces objectifs doivent être démontrés par les mesures de l’exercice, pas simplement supposés.',
        'Objectifs déclarés · données de chronologie à vérifier',
        'Comparer les temps réellement observés aux objectifs métier approuvés',
        [
          answer('iso-measure', 'Mesurer le temps de détection, de bascule et la cohérence des données répliquées', 'Comparer les résultats observés aux objectifs RTO < 1 min et RPO = 0.', 'Les écarts sont documentés et le plan est corrigé à partir de preuves.', 'Biais évité : confondre objectif inscrit et capacité démontrée.', true),
          answer('iso-assume', 'Déclarer le RTO et le RPO atteints car le service répond à nouveau', 'Le retour du service ne renseigne ni sur la durée exacte ni sur les données manquantes.', 'Le rapport de continuité annonce des garanties non vérifiées.', 'Biais commis : conclure à partir d’un seul indicateur.', false, { security: 1, availability: 4, logic: -16 }),
          answer('iso-ignore', 'Ne pas mesurer pour éviter de révéler un écart', 'L’absence de mesure empêche toute amélioration et réduit l’auditabilité.', 'Les risques de reprise restent inconnus jusqu’au prochain incident.', 'Biais commis : confondre absence de preuve et absence de problème.', false, { security: -7, availability: -6, logic: -18 }),
        ],
      ),
      question(
        'iso-evidence',
        'Contrôler les comptes de secours et journaux',
        'Les comptes d’urgence sont répliqués et des journaux locaux sont conservés sur DC1 et DC2. Il faut vérifier leur intégrité, leur disponibilité et les droits associés.',
        'Réplication et journaux locaux disponibles · revue d’accès requise',
        'Ne jamais exposer les secrets de secours dans le rapport ou le chat',
        [
          answer('iso-audit-evidence', 'Vérifier la réplication, les droits minimaux et la continuité des journaux sur les deux nœuds', 'Consigner les références et résultats sans copier les secrets d’authentification.', 'Les preuves de reprise sont protégées et exploitables pour l’audit.', 'Biais évité : documenter des secrets au lieu de documenter les contrôles.', true),
          answer('iso-share-secrets', 'Joindre les identifiants de secours en clair au rapport de crise', 'La traçabilité ne nécessite pas de divulguer des secrets.', 'Le rapport devient une nouvelle source d’exposition.', 'Biais commis : confondre preuve d’existence et partage de credential.', false, { security: -24, availability: 0, logic: -13 }),
          answer('iso-disable-logs', 'Supprimer les journaux locaux après la reprise', 'Les journaux sont nécessaires pour comprendre la bascule et prouver le RPO.', 'La capacité d’audit et d’analyse post-incident est réduite.', 'Biais commis : réduire le stockage au détriment de la preuve.', false, { security: -12, availability: 0, logic: -15 }),
        ],
      ),
      question(
        'iso-failback',
        'Organiser le retour du VLAN 99 au VLAN 11',
        'Le service central est stable. Des équipements sont encore en Critical VLAN 99. Le failback doit réauthentifier les postes et valider les politiques avant leur retour en production VLAN 11.',
        'DC1/DC2 opérationnels · postes en mode survie à réintégrer',
        'Préserver la continuité et contrôler chaque vague de réauthentification',
        [
          answer('iso-staged-return', 'Réauthentifier par lots, vérifier les politiques et déplacer uniquement les postes conformes vers VLAN 11', 'Conserver un suivi des refus et une possibilité d’arrêt entre les vagues.', 'La reprise est progressive, contrôlée et compatible avec la continuité métier.', 'Biais évité : traiter la récupération comme un simple changement de VLAN.', true),
          answer('iso-mass-return', 'Basculer tous les ports du VLAN 99 vers le VLAN 11 en une seule fois', 'La politique centrale et la conformité de chaque poste ne sont pas encore confirmées.', 'Un défaut de configuration ou un poste non conforme peut affecter la production.', 'Biais commis : choisir le retour le plus rapide sans validation.', false, { security: -13, availability: -10, logic: -12 }),
          answer('iso-stay-99', 'Laisser tous les postes en VLAN 99 sans date de sortie', 'Le mode de survie est limité et n’est pas une architecture de fonctionnement normal.', 'Les services métiers restent dégradés et les exceptions s’accumulent.', 'Biais commis : laisser la solution temporaire remplacer le plan de reprise.', false, { security: -8, availability: -15, logic: -12 }),
        ],
      ),
      question(
        'iso-platform',
        'Choisir la suite de l’architecture NAC',
        'Le comité compare PacketFence open source, Cisco ISE, Aruba ClearPass et FortiNAC. La décision dépend du budget total, des compétences, de l’intégration, du support et des résultats des tests PCA/PRA.',
        'Comparatif fournisseur requis · objectifs de continuité à conserver',
        'Évaluer sur les besoins mesurés plutôt que sur une marque seule',
        [
          answer('iso-evaluate', 'Comparer coût total, intégration, compétences, support et RTO/RPO lors d’un pilote', 'Inclure les coûts d’exploitation, la résilience, la supervision et la réversibilité.', 'Le choix est traçable et aligné sur l’architecture comme sur le budget.', 'Biais évité : choisir uniquement selon le prix initial ou la notoriété.', true),
          answer('iso-brand', 'Choisir immédiatement la solution la plus connue sans pilote', 'La notoriété ne démontre ni intégration ni atteinte des objectifs de continuité.', 'Les contraintes d’exploitation peuvent apparaître après l’achat.', 'Biais commis : remplacer une évaluation par un raccourci de marque.', false, { security: -4, availability: -5, logic: -16 }),
          answer('iso-price-only', 'Retenir uniquement le coût de licence le plus bas', 'Le coût complet inclut intégration, formation, maintenance et indisponibilité potentielle.', 'Une économie initiale peut augmenter le coût opérationnel et le risque de reprise.', 'Biais commis : ignorer le coût total de possession.', false, { security: -5, availability: -8, logic: -14 }),
        ],
      ),
    ],
  }),
];
