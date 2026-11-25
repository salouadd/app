export const defaultScenarios = [
  {
    id: 'nac-failover',
    title: 'Le NAC tombe à 8h30',
    domain: 'Cybersécurité & réseaux',
    difficulty: 'Avancé',
    duration: '12 min',
    objective: 'Arbitrer le basculement PCA/PRA sans sacrifier la continuité ni le contrôle réseau.',
    description:
      'Panne critique du serveur central NAC (PacketFence) à 8h30 : gérer le basculement PCA/PRA sans paralyser l’entreprise ni ouvrir une brèche réseau.',
    accent: 'cyan',
    steps: [
      {
        id: 'nac-triage',
        title: 'Confirmer l’étendue de la panne',
        context:
          'À 8h30, le serveur central NAC ne répond plus. Les équipements déjà authentifiés communiquent encore, mais les nouvelles connexions échouent sur plusieurs sites.',
        alert: 'NAC central indisponible · nouvelles authentifications en échec',
        constraint: 'Décision attendue en 3 minutes',
        options: [
          {
            id: 'nac-health',
            label: 'Vérifier l’état des nœuds, des services et du périmètre affecté',
            detail: 'Établir rapidement si la panne est locale ou généralisée avant de modifier la politique réseau.',
            impact: { security: 8, availability: 5, logic: 12 },
            consequence:
              'Vous confirmez le périmètre avant d’agir. Cette vérification ciblée évite de confondre une panne du plan de contrôle avec une rupture générale du réseau.',
            bias: 'Biais évité : agir sous pression sans avoir vérifié l’hypothèse initiale.',
            next: 'nac-route',
            recommended: true,
          },
          {
            id: 'nac-open',
            label: 'Passer tous les ports en accès ouvert pour rétablir les connexions',
            detail: 'La disponibilité remonte vite, mais l’accès n’est plus soumis au contrôle habituel.',
            impact: { security: -24, availability: 22, logic: -12 },
            consequence:
              'L’ouverture globale masque l’incident d’authentification en supprimant le contrôle au lieu de rétablir le service. Des équipements inconnus pourraient rejoindre des segments sensibles.',
            bias: 'Biais commis : privilégier la disponibilité immédiate sans borner le risque.',
            next: 'nac-route',
            recommended: false,
          },
          {
            id: 'nac-stop',
            label: 'Bloquer toutes les nouvelles connexions sur tous les sites',
            detail: 'Le contrôle est conservé, au prix d’un arrêt étendu des activités.',
            impact: { security: 12, availability: -22, logic: -5 },
            consequence:
              'La mesure contient les nouvelles admissions mais dépasse le périmètre confirmé et pénalise les sites encore sains.',
            bias: 'Biais commis : traiter toute incertitude comme une menace uniforme.',
            next: 'nac-route',
            recommended: false,
          },
        ],
      },
      {
        id: 'nac-route',
        title: 'Choisir une stratégie de continuité',
        context:
          'Le diagnostic confirme que le nœud principal est indisponible. Les politiques sont sauvegardées et le nœud de secours n’a pas encore été activé.',
        alert: 'Nœud secondaire disponible · état de réplication à confirmer',
        constraint: 'Les politiques doivent rester cohérentes entre les sites',
        options: [
          {
            id: 'nac-standby',
            label: 'Valider la réplication puis basculer le service vers le nœud de secours',
            detail: 'Le basculement suit le PCA existant et garde une décision contrôlable.',
            impact: { security: 9, availability: 15, logic: 12 },
            consequence:
              'Vous réutilisez un mécanisme préparé et vérifiez sa cohérence avant activation : le rétablissement reste auditable et les politiques ne sont pas improvisées.',
            bias: 'Biais évité : remplacer un plan testé par une solution de fortune.',
            next: 'nac-recovery',
            recommended: true,
          },
          {
            id: 'nac-local',
            label: 'Appliquer une politique temporaire locale, limitée aux équipements connus',
            detail: 'Un compromis borné peut préserver les services prioritaires pendant le diagnostic.',
            impact: { security: 2, availability: 9, logic: 6 },
            consequence:
              'Une politique de secours limitée peut convenir si son périmètre, sa durée et son retour arrière sont explicitement contrôlés.',
            bias: 'Point de vigilance : formaliser l’expiration de la mesure pour éviter qu’elle ne devienne permanente.',
            next: 'nac-recovery',
            recommended: false,
          },
          {
            id: 'nac-restart',
            label: 'Redémarrer immédiatement le serveur principal sans vérifier le secours',
            detail: 'C’est une action familière, mais elle ne traite pas la continuité pendant l’incertitude.',
            impact: { security: 0, availability: -9, logic: -8 },
            consequence:
              'Le redémarrage peut prolonger l’interruption et détruire des indices utiles sans garantie de retour du service.',
            bias: 'Biais commis : confondre action rapide et réduction du risque.',
            next: 'nac-recovery',
            recommended: false,
          },
        ],
      },
      {
        id: 'nac-recovery',
        title: 'Protéger les services prioritaires',
        context:
          'Le service de secours est prêt ou une mesure locale limitée est active. Les équipes métiers signalent des besoins urgents pour la production et les postes d’administration.',
        alert: 'Priorités métier reçues · changements à tracer',
        constraint: 'Éviter toute exception réseau sans responsable ni échéance',
        options: [
          {
            id: 'nac-priorities',
            label: 'Prioriser les flux indispensables et consigner chaque exception avec une échéance',
            detail: 'Les exceptions restent limitées, attribuées et réversibles.',
            impact: { security: 8, availability: 11, logic: 12 },
            consequence:
              'La continuité est ciblée sur les services essentiels. La traçabilité et l’expiration des exceptions facilitent la revue puis le retour à la politique normale.',
            bias: 'Biais évité : laisser une exception d’urgence devenir une règle permanente.',
            next: 'nac-validate',
            recommended: true,
          },
          {
            id: 'nac-everyone',
            label: 'Autoriser tous les postes du VLAN Production le temps de l’incident',
            detail: 'La solution est simple à communiquer, mais élargit l’exception au-delà du besoin.',
            impact: { security: -17, availability: 12, logic: -9 },
            consequence:
              'Une appartenance au VLAN ne prouve pas l’identité ni l’état de conformité du poste. L’exception peut transformer une panne limitée en perte de contrôle.',
            bias: 'Biais commis : assimiler emplacement réseau et confiance.',
            next: 'nac-validate',
            recommended: false,
          },
          {
            id: 'nac-wait',
            label: 'Attendre la réparation complète avant de rétablir les services',
            detail: 'L’exposition reste faible, mais aucune priorité métier n’est prise en compte.',
            impact: { security: 6, availability: -14, logic: -4 },
            consequence:
              'L’attente réduit les changements mais prolonge inutilement l’impact si des services essentiels pouvaient être rétablis de façon bornée.',
            bias: 'Biais commis : confondre prudence et absence d’arbitrage.',
            next: 'nac-validate',
            recommended: false,
          },
        ],
      },
      {
        id: 'nac-validate',
        title: 'Organiser le retour à la normale',
        context:
          'Les services prioritaires sont opérationnels. Le nœud principal reste en cours de réparation et les équipes s’apprêtent à clôturer l’incident.',
        alert: 'Continuité rétablie · contrôles de cohérence requis',
        constraint: 'Ne pas perdre les changements effectués pendant la crise',
        options: [
          {
            id: 'nac-audit',
            label: 'Comparer les politiques, révoquer les exceptions échues et tester un retour contrôlé',
            detail: 'Une clôture vérifiée évite que la solution de crise ne crée un risque durable.',
            impact: { security: 12, availability: 6, logic: 13 },
            consequence:
              'Vous validez la cohérence des politiques et le comportement des services avant de fermer l’incident. Les écarts temporaires sont retirés de manière vérifiable.',
            bias: 'Biais évité : considérer le service rétabli comme preuve que le risque est clos.',
            next: null,
            recommended: true,
          },
          {
            id: 'nac-close',
            label: 'Clôturer dès que les utilisateurs peuvent se reconnecter',
            detail: 'Le service est visible, mais les exceptions et la réplication restent à contrôler.',
            impact: { security: -8, availability: 5, logic: -8 },
            consequence:
              'La reprise apparente ne confirme pas que les politiques sont cohérentes ni que les dérogations d’urgence ont été supprimées.',
            bias: 'Biais commis : clôture prématurée fondée sur un seul indicateur.',
            next: null,
            recommended: false,
          },
          {
            id: 'nac-disable',
            label: 'Désactiver durablement le contrôle NAC pour prévenir une nouvelle panne',
            detail: 'Cette décision évite un blocage futur en abandonnant la fonction de contrôle.',
            impact: { security: -25, availability: 8, logic: -16 },
            consequence:
              'Supprimer le contrôle n’élimine pas la cause de la panne et augmente durablement le risque d’accès non maîtrisé.',
            bias: 'Biais commis : généraliser une mesure d’urgence au fonctionnement normal.',
            next: null,
            recommended: false,
          },
        ],
      },
    ],
  },
  {
    id: 'insider-response',
    title: 'Un poste agit hors profil',
    domain: 'Réponse à incident',
    difficulty: 'Avancé',
    duration: '10 min',
    objective: 'Contenir un poste suspect sans isoler tout le VLAN de production.',
    description:
      'Détection d’un comportement latéral suspect depuis un poste employé déjà authentifié en VLAN Production : appliquer une riposte dynamique (RADIUS CoA / quarantaine) sans couper le reste du réseau.',
    accent: 'amber',
    steps: [
      {
        id: 'insider-verify',
        title: 'Qualifier le signal sans alerter toute la production',
        context:
          'Une alerte signale des connexions inhabituelles depuis un poste employé authentifié en VLAN Production. Les autres équipements semblent fonctionner normalement.',
        alert: 'Comportement latéral suspect · identité connue, posture à confirmer',
        constraint: 'Éviter les perturbations collatérales',
        options: [
          {
            id: 'insider-correlate',
            label: 'Corréler l’identité, la posture du poste et les événements récents',
            detail: 'Confirmer le signal avec plusieurs sources avant une mesure ciblée.',
            impact: { security: 8, availability: 5, logic: 13 },
            consequence:
              'La corrélation distingue une anomalie isolée d’un comportement confirmé et aide à attribuer la mesure au bon poste.',
            bias: 'Biais évité : prendre une alerte unique pour une preuve suffisante.',
            next: 'insider-contain',
            recommended: true,
          },
          {
            id: 'insider-vlan',
            label: 'Isoler immédiatement tout le VLAN Production',
            detail: 'La portée de l’alerte n’est pas encore connue, mais l’impact serait massif.',
            impact: { security: 12, availability: -25, logic: -8 },
            consequence:
              'Une isolation générale peut contenir le poste suspect, mais coupe aussi les systèmes sains et complique la réponse opérationnelle.',
            bias: 'Biais commis : confondre rapidité et précision du périmètre.',
            next: 'insider-contain',
            recommended: false,
          },
          {
            id: 'insider-ignore',
            label: 'Ignorer l’alerte : le poste est déjà authentifié',
            detail: 'Une authentification antérieure ne garantit ni la posture actuelle ni l’absence de compromission.',
            impact: { security: -20, availability: 3, logic: -14 },
            consequence:
              'L’authentification prouve un état à un instant donné, pas l’innocuité des actions ultérieures. Le signal reste sans qualification.',
            bias: 'Biais commis : confondre identité valide et comportement sûr.',
            next: 'insider-contain',
            recommended: false,
          },
        ],
      },
      {
        id: 'insider-contain',
        title: 'Choisir une mesure de confinement ciblée',
        context:
          'Les éléments disponibles désignent un poste et une identité précis. Le reste du segment ne présente pas le même comportement.',
        alert: 'Cible identifiée · session active',
        constraint: 'Conserver les éléments utiles à l’investigation',
        options: [
          {
            id: 'insider-coa',
            label: 'Déclencher une réauthentification ciblée et placer le poste en quarantaine',
            detail: 'La réponse dynamique cible la session concernée et laisse les autres flux intacts.',
            impact: { security: 15, availability: 8, logic: 12 },
            consequence:
              'Une action de contrôle d’accès par session limite l’exposition tout en préservant la production non impliquée. Le résultat doit être confirmé côté réseau.',
            bias: 'Biais évité : utiliser une mesure globale pour un incident attribué à un seul poste.',
            next: 'insider-investigate',
            recommended: true,
          },
          {
            id: 'insider-acl',
            label: 'Appliquer une restriction temporaire au seul port ou poste concerné',
            detail: 'Une restriction locale est une option de repli si la réponse dynamique n’est pas disponible.',
            impact: { security: 9, availability: 5, logic: 8 },
            consequence:
              'Le périmètre réduit protège le réseau sans dépendre d’une modification générale. Documentez la mesure et préparez sa levée contrôlée.',
            bias: 'Point de vigilance : vérifier le rattachement entre l’identité, le poste et le port.',
            next: 'insider-investigate',
            recommended: false,
          },
          {
            id: 'insider-reset',
            label: 'Réinitialiser le mot de passe sans contenir le poste',
            detail: 'La mesure sur l’identité ne met pas fin à une session déjà active.',
            impact: { security: -7, availability: 0, logic: -9 },
            consequence:
              'Une action sur le compte peut être utile, mais elle ne remplace pas le confinement de l’équipement ni la vérification des sessions actives.',
            bias: 'Biais commis : traiter un incident de poste uniquement comme un problème d’identifiants.',
            next: 'insider-investigate',
            recommended: false,
          },
        ],
      },
      {
        id: 'insider-investigate',
        title: 'Préserver les preuves et vérifier le périmètre',
        context:
          'Le poste est isolé ou restreint. L’équipe de réponse doit déterminer s’il existe d’autres systèmes touchés sans altérer les éléments disponibles.',
        alert: 'Confinement en cours · investigation à coordonner',
        constraint: 'Ne pas effacer les traces avant leur collecte',
        options: [
          {
            id: 'insider-preserve',
            label: 'Préserver les journaux, relever les indicateurs et rechercher des postes liés',
            detail: 'L’investigation s’appuie sur des éléments conservés et un périmètre vérifiable.',
            impact: { security: 11, availability: 6, logic: 13 },
            consequence:
              'La collecte ordonnée soutient l’analyse et permet de vérifier si le poste est un cas isolé avant toute extension du confinement.',
            bias: 'Biais évité : supprimer ou modifier les preuves en voulant nettoyer trop vite.',
            next: 'insider-recover',
            recommended: true,
          },
          {
            id: 'insider-wipe',
            label: 'Réinitialiser immédiatement le poste et effacer ses données',
            detail: 'Le poste peut repartir proprement, mais les éléments d’analyse risquent de disparaître.',
            impact: { security: -3, availability: -7, logic: -14 },
            consequence:
              'L’effacement avant collecte détruit potentiellement des éléments nécessaires pour comprendre la portée et prévenir la récidive.',
            bias: 'Biais commis : privilégier le nettoyage au détriment de l’investigation.',
            next: 'insider-recover',
            recommended: false,
          },
          {
            id: 'insider-broadcast',
            label: 'Diffuser l’identité de l’employé à toute l’entreprise avant vérification',
            detail: 'La communication prématurée expose des informations et peut gêner l’enquête.',
            impact: { security: -5, availability: 0, logic: -12 },
            consequence:
              'Une communication non coordonnée ne renforce pas le confinement et peut nuire à la confidentialité de l’enquête.',
            bias: 'Biais commis : substituer une réaction visible à une réponse opérationnelle.',
            next: 'insider-recover',
            recommended: false,
          },
        ],
      },
      {
        id: 'insider-recover',
        title: 'Réintégrer uniquement après validation',
        context:
          'Les éléments ont été préservés et la portée de l’incident est mieux comprise. Le métier demande la remise en service du poste.',
        alert: 'Demande de réintégration · posture de sécurité à revalider',
        constraint: 'La remise en service doit être traçable et réversible',
        options: [
          {
            id: 'insider-restore',
            label: 'Valider la remédiation, réauthentifier et réintégrer sous surveillance',
            detail: 'La réintégration dépend de contrôles observables et d’un suivi renforcé.',
            impact: { security: 12, availability: 9, logic: 13 },
            consequence:
              'Une remise en service conditionnelle rétablit l’activité sans transformer la quarantaine en simple pause non vérifiée.',
            bias: 'Biais évité : supposer que le temps passé en quarantaine suffit à résoudre l’incident.',
            next: null,
            recommended: true,
          },
          {
            id: 'insider-release',
            label: 'Lever la quarantaine dès que le collaborateur le demande',
            detail: 'La demande métier ne constitue pas un contrôle de remédiation.',
            impact: { security: -17, availability: 6, logic: -12 },
            consequence:
              'Sans validation de la posture, le comportement suspect peut reprendre dès la levée du confinement.',
            bias: 'Biais commis : confondre pression de service et preuve de sécurité.',
            next: null,
            recommended: false,
          },
          {
            id: 'insider-ban',
            label: 'Maintenir une quarantaine permanente sans réévaluation',
            detail: 'Le risque peut être contenu, mais la mesure n’est ni proportionnée ni révisable.',
            impact: { security: 4, availability: -14, logic: -7 },
            consequence:
              'Une quarantaine durable sans critères de sortie pénalise le métier et ne remplace pas une remédiation vérifiée.',
            bias: 'Biais commis : transformer une mesure temporaire en sanction sans critères.',
            next: null,
            recommended: false,
          },
        ],
      },
    ],
  },
  {
    id: 'ddos-tradeoff',
    title: 'DDoS : arbitrage sous pression',
    domain: 'Logique & architecture',
    difficulty: 'Expert',
    duration: '14 min',
    objective: 'Arbitrer disponibilité, intégrité et isolement avec des signaux contradictoires.',
    description:
      'Arbitrage d’architecture critique sous attaque DDoS : prioriser la disponibilité, l’intégrité ou l’isolement face à des alertes contradictoires.',
    accent: 'emerald',
    steps: [
      {
        id: 'ddos-signals',
        title: 'Distinguer saturation et compromission',
        context:
          'Le portail client est ralenti par un volume de trafic inhabituel. Une alerte d’intégrité vient de se déclencher, tandis que les journaux sont partiellement retardés.',
        alert: 'Latence élevée · signal d’intégrité non encore corroboré',
        constraint: 'Éviter une modification irréversible sur une alerte isolée',
        options: [
          {
            id: 'ddos-correlate',
            label: 'Comparer les métriques de trafic, les contrôles d’intégrité et les journaux indépendants',
            detail: 'Une vérification croisée sépare les faits confirmés des signaux contradictoires.',
            impact: { security: 8, availability: 5, logic: 14 },
            consequence:
              'Vous évitez de traiter une alerte incertaine comme une compromission avérée tout en gardant la possibilité de contenir rapidement un impact confirmé.',
            bias: 'Biais évité : ancrage sur le signal le plus alarmant.',
            next: 'ddos-scope',
            recommended: true,
          },
          {
            id: 'ddos-shutdown',
            label: 'Couper tous les services publics immédiatement',
            detail: 'L’isolement est maximal mais la disponibilité est abandonnée sans mesure de périmètre.',
            impact: { security: 10, availability: -23, logic: -8 },
            consequence:
              'L’arrêt global limite l’exposition, mais rien ne démontre que toutes les fonctions sont touchées ou que cette mesure soit nécessaire.',
            bias: 'Biais commis : appliquer la mesure la plus forte en l’absence de comparaison.',
            next: 'ddos-scope',
            recommended: false,
          },
          {
            id: 'ddos-ignore',
            label: 'Ignorer l’alerte d’intégrité et augmenter seulement la capacité',
            detail: 'Augmenter les ressources peut soulager la charge sans expliquer le signal d’intégrité.',
            impact: { security: -15, availability: 11, logic: -12 },
            consequence:
              'Le renforcement de capacité ne répond pas à une éventuelle altération et peut retarder une investigation indispensable.',
            bias: 'Biais commis : réduire un incident multi-signal à un seul indicateur de performance.',
            next: 'ddos-scope',
            recommended: false,
          },
        ],
      },
      {
        id: 'ddos-scope',
        title: 'Réduire l’impact sans masquer les preuves',
        context:
          'Les premières vérifications confirment un pic de trafic sur le portail, mais ne confirment pas encore d’altération des données. Les services internes restent disponibles.',
        alert: 'Impact public concentré · services internes stables',
        constraint: 'Protéger les fonctions essentielles et conserver les traces',
        options: [
          {
            id: 'ddos-edge',
            label: 'Appliquer une atténuation graduée en périphérie et suivre ses effets',
            detail: 'Une mesure réversible et ciblée protège l’origine sans couper les services non touchés.',
            impact: { security: 8, availability: 14, logic: 12 },
            consequence:
              'L’atténuation ciblée réduit la charge à la périphérie et permet de mesurer les faux positifs avant d’élargir la réponse.',
            bias: 'Biais évité : traiter tous les flux et tous les services de la même façon.',
            next: 'ddos-integrity',
            recommended: true,
          },
          {
            id: 'ddos-origin',
            label: 'Exposer directement l’origine pour contourner l’intermédiaire saturé',
            detail: 'Cela contourne un point de protection et rend l’origine plus accessible.',
            impact: { security: -18, availability: 6, logic: -10 },
            consequence:
              'Contourner la protection peut rendre l’origine vulnérable et ne garantit pas de résoudre la saturation.',
            bias: 'Biais commis : confondre contournement du symptôme et réduction de l’exposition.',
            next: 'ddos-integrity',
            recommended: false,
          },
          {
            id: 'ddos-throttle',
            label: 'Limiter uniformément toutes les requêtes à un seuil très bas',
            detail: 'Une limitation aveugle protège les ressources au risque de rejeter les clients légitimes.',
            impact: { security: 3, availability: -9, logic: -5 },
            consequence:
              'Une limite uniforme peut pénaliser les usages légitimes et n’exploite pas l’information sur les flux réellement anormaux.',
            bias: 'Biais commis : utiliser une règle simple sans observer ses effets différenciés.',
            next: 'ddos-integrity',
            recommended: false,
          },
        ],
      },
      {
        id: 'ddos-integrity',
        title: 'Traiter l’alerte d’intégrité',
        context:
          'La charge a diminué. Une comparaison secondaire signale un écart sur un composant, sans confirmer si cet écart est lié à l’attaque ou à un déploiement récent.',
        alert: 'Écart d’intégrité à qualifier · origine inconnue',
        constraint: 'Maintenir les fonctions saines isolées du composant douteux',
        options: [
          {
            id: 'ddos-isolate',
            label: 'Isoler le composant concerné, préserver une copie des preuves et comparer à la référence',
            detail: 'L’isolement local limite l’exposition sans sacrifier le service entier.',
            impact: { security: 14, availability: 5, logic: 14 },
            consequence:
              'Vous traitez le signal comme important sans conclure trop tôt à une compromission. La comparaison à une référence connue permet de distinguer déploiement et altération.',
            bias: 'Biais évité : choisir entre « tout va bien » et « tout est compromis » sans option intermédiaire.',
            next: 'ddos-priorities',
            recommended: true,
          },
          {
            id: 'ddos-rollback',
            label: 'Restaurer tout l’environnement depuis la dernière sauvegarde',
            detail: 'Un retour global peut réintroduire des composants sains dans une panne.',
            impact: { security: 6, availability: -17, logic: -8 },
            consequence:
              'La restauration générale n’est pas proportionnée à un écart limité et non attribué ; elle complique aussi l’analyse de la cause.',
            bias: 'Biais commis : confondre action de remédiation et retour aveugle à un état antérieur.',
            next: 'ddos-priorities',
            recommended: false,
          },
          {
            id: 'ddos-dismiss',
            label: 'Classer l’écart comme faux positif sans vérification complémentaire',
            detail: 'L’hypothèse du déploiement est plausible, mais reste à confirmer.',
            impact: { security: -16, availability: 5, logic: -15 },
            consequence:
              'Une explication probable n’est pas une preuve. L’écart pourrait masquer un changement non autorisé.',
            bias: 'Biais commis : privilégier l’explication rassurante sans la tester.',
            next: 'ddos-priorities',
            recommended: false,
          },
        ],
      },
      {
        id: 'ddos-priorities',
        title: 'Définir l’arbitrage et clôturer',
        context:
          'La charge est maîtrisée et le composant douteux est contenu. Les équipes doivent maintenir les services essentiels puis préparer une sortie coordonnée de crise.',
        alert: 'Incident stabilisé · suivi renforcé nécessaire',
        constraint: 'Décision finale : expliciter le compromis et ses critères de sortie',
        options: [
          {
            id: 'ddos-balanced',
            label: 'Maintenir les fonctions saines, suivre les seuils et lever les mesures par étapes',
            detail: 'L’arbitrage reste mesurable et peut être révisé en fonction des faits.',
            impact: { security: 10, availability: 11, logic: 14 },
            consequence:
              'Vous rendez l’arbitrage explicite : disponibilité essentielle, intégrité vérifiée et isolement limité au périmètre suspect. Des critères observables guident le retour à la normale.',
            bias: 'Biais évité : défendre une priorité unique quand les contraintes peuvent être conciliées.',
            next: null,
            recommended: true,
          },
          {
            id: 'ddos-availability',
            label: 'Tout réactiver immédiatement au nom de la disponibilité',
            detail: 'La pression métier prend le pas sur les vérifications restantes.',
            impact: { security: -15, availability: 13, logic: -10 },
            consequence:
              'La disponibilité remonte, mais sans vérifier l’intégrité ni établir des critères de sortie, l’incident peut reprendre.',
            bias: 'Biais commis : optimiser un seul objectif et ignorer les risques résiduels.',
            next: null,
            recommended: false,
          },
          {
            id: 'ddos-isolation',
            label: 'Maintenir tous les services isolés jusqu’à certitude absolue',
            detail: 'La certitude complète peut être impossible et les services sains restent indisponibles.',
            impact: { security: 9, availability: -19, logic: -6 },
            consequence:
              'L’isolement prolongé réduit certains risques mais n’établit aucun seuil de décision pour une reprise proportionnée.',
            bias: 'Biais commis : exiger une certitude impossible plutôt que définir une tolérance au risque.',
            next: null,
            recommended: false,
          },
        ],
      },
    ],
  },
  {
    id: 'backup-integrity',
    title: 'Une sauvegarde à valider',
    domain: 'Continuité & résilience',
    difficulty: 'Intermédiaire',
    duration: '9 min',
    objective: 'Vérifier la restaurabilité des sauvegardes sans compromettre les données de production.',
    description:
      'Une alerte signale un écart sur la dernière sauvegarde avant une maintenance planifiée. Évaluez les preuves, choisissez une reprise contrôlée et documentez le retour au service.',
    accent: 'cyan',
    steps: [
      {
        id: 'backup-alert',
        title: 'Qualifier l’alerte de sauvegarde',
        context:
          'Le contrôle automatique détecte une différence entre le manifeste attendu et la dernière sauvegarde. Les services de production fonctionnent normalement.',
        alert: 'Écart de vérification · intégrité non confirmée',
        constraint: 'Ne pas modifier la copie de référence pendant l’analyse',
        options: [
          {
            id: 'backup-compare',
            label: 'Comparer les journaux, le manifeste et une copie de contrôle indépendante',
            detail: 'La comparaison croisée détermine si l’écart est réel avant toute restauration.',
            impact: { security: 8, availability: 5, logic: 13 },
            consequence: 'Vous préservez la source et vérifiez l’alerte avec des éléments indépendants avant de choisir une reprise.',
            bias: 'Biais évité : transformer un signal automatisé en diagnostic définitif.',
            next: 'backup-isolate',
            recommended: true,
          },
          {
            id: 'backup-overwrite',
            label: 'Relancer immédiatement la sauvegarde en écrasant la copie existante',
            detail: 'Une nouvelle exécution peut effacer la seule copie utile à l’investigation.',
            impact: { security: -7, availability: 2, logic: -12 },
            consequence: 'L’écrasement détruit un point de comparaison et peut remplacer une copie saine par une copie incomplète.',
            bias: 'Biais commis : agir avant de préserver les éléments de diagnostic.',
            next: 'backup-isolate',
            recommended: false,
          },
          {
            id: 'backup-ignore',
            label: 'Ignorer l’alerte puisque la production fonctionne encore',
            detail: 'Le bon fonctionnement actuel ne confirme pas la capacité de restauration.',
            impact: { security: -8, availability: -5, logic: -12 },
            consequence: 'L’incident peut rester invisible jusqu’au moment où une restauration devient nécessaire.',
            bias: 'Biais commis : confondre disponibilité actuelle et capacité de reprise.',
            next: 'backup-isolate',
            recommended: false,
          },
        ],
      },
      {
        id: 'backup-isolate',
        title: 'Protéger la copie de référence',
        context:
          'L’écart n’est pas encore expliqué. Une copie antérieure est disponible et le dépôt de sauvegarde accepte les opérations de maintenance.',
        alert: 'Copie antérieure disponible · cause de l’écart inconnue',
        constraint: 'Éviter toute propagation de l’anomalie aux copies valides',
        options: [
          {
            id: 'backup-preserve',
            label: 'Protéger la copie connue, suspendre sa rotation et créer une copie de travail',
            detail: 'L’analyse se fait sur une copie sans altérer la référence.',
            impact: { security: 10, availability: 6, logic: 12 },
            consequence: 'La copie de référence reste disponible pour la reprise tandis que l’analyse peut se poursuivre sans risque de l’altérer.',
            bias: 'Biais évité : traiter toutes les copies comme interchangeables.',
            next: 'backup-restore-test',
            recommended: true,
          },
          {
            id: 'backup-rotate',
            label: 'Laisser la rotation automatique supprimer les anciennes copies',
            detail: 'Une politique normale peut éliminer les dernières versions vérifiées.',
            impact: { security: -9, availability: -12, logic: -8 },
            consequence: 'La rotation peut supprimer une copie encore restaurable avant que l’écart soit compris.',
            bias: 'Biais commis : supposer qu’un automatisme reste adapté pendant un incident.',
            next: 'backup-restore-test',
            recommended: false,
          },
          {
            id: 'backup-disable',
            label: 'Désactiver durablement les sauvegardes pour éviter toute nouvelle anomalie',
            detail: 'L’arrêt supprime aussi la protection contre les incidents suivants.',
            impact: { security: -8, availability: -15, logic: -10 },
            consequence: 'La suspension générale réduit la capacité de reprise et ne traite pas la cause de l’écart.',
            bias: 'Biais commis : supprimer une fonction critique au lieu de borner le problème.',
            next: 'backup-restore-test',
            recommended: false,
          },
        ],
      },
      {
        id: 'backup-restore-test',
        title: 'Tester la restauration sans exposer la production',
        context:
          'Une copie indépendante est protégée. L’équipe doit confirmer qu’elle est exploitable avant la fenêtre de maintenance.',
        alert: 'Restauration à tester · environnement isolé disponible',
        constraint: 'Conserver les contrôles d’accès et la traçabilité du test',
        options: [
          {
            id: 'backup-sandbox',
            label: 'Restaurer un échantillon dans un environnement isolé et vérifier son intégrité',
            detail: 'Le test confirme la récupérabilité sans toucher aux services actifs.',
            impact: { security: 9, availability: 8, logic: 13 },
            consequence: 'Le test en environnement isolé vérifie l’intégrité et le temps de reprise sans perturber la production.',
            bias: 'Biais évité : prendre la réussite d’une tâche de sauvegarde pour preuve de restaurabilité.',
            next: 'backup-close',
            recommended: true,
          },
          {
            id: 'backup-live',
            label: 'Restaurer directement sur les données de production pour gagner du temps',
            detail: 'Le test peut remplacer des données fonctionnelles avant validation.',
            impact: { security: -11, availability: -18, logic: -12 },
            consequence: 'La restauration directe transforme un test en changement risqué et peut interrompre les services ou écraser des données récentes.',
            bias: 'Biais commis : confondre environnement de test et cible de production.',
            next: 'backup-close',
            recommended: false,
          },
          {
            id: 'backup-trust',
            label: 'Considérer la sauvegarde valide dès que la tâche se termine sans erreur',
            detail: 'Le statut de la tâche ne teste pas le contenu ni la durée de reprise.',
            impact: { security: -6, availability: -6, logic: -13 },
            consequence: 'Un statut de réussite ne garantit ni la cohérence applicative ni le respect des objectifs de reprise.',
            bias: 'Biais commis : confondre succès du processus et succès de la restauration.',
            next: 'backup-close',
            recommended: false,
          },
        ],
      },
      {
        id: 'backup-close',
        title: 'Documenter la décision et rétablir les contrôles',
        context:
          'Le test de restauration est terminé. La maintenance approche et les responsables doivent connaître les limites et les actions restantes.',
        alert: 'Résultat du test disponible · suivi opérationnel requis',
        constraint: 'Chaque exception doit avoir un responsable et une échéance',
        options: [
          {
            id: 'backup-report',
            label: 'Consigner le résultat, le point de reprise vérifié et les actions de suivi datées',
            detail: 'La décision reste vérifiable et les contrôles temporaires peuvent être levés.',
            impact: { security: 8, availability: 9, logic: 13 },
            consequence: 'Les équipes disposent d’un point de reprise vérifié, de limites documentées et d’actions attribuées pour corriger l’écart.',
            bias: 'Biais évité : clôturer sans transmettre les conditions de reprise.',
            next: null,
            recommended: true,
          },
          {
            id: 'backup-close-fast',
            label: 'Clôturer l’alerte sans partager le résultat du test',
            detail: 'Les équipes suivantes risquent de supposer que toutes les données sont couvertes.',
            impact: { security: -4, availability: -6, logic: -12 },
            consequence: 'Sans compte rendu, le périmètre réellement restaurable reste inconnu des personnes qui géreront la prochaine reprise.',
            bias: 'Biais commis : confondre test réalisé et information transmise.',
            next: null,
            recommended: false,
          },
          {
            id: 'backup-exception',
            label: 'Maintenir les accès de maintenance ouverts sans date de fermeture',
            detail: 'Une mesure temporaire non suivie peut devenir une exposition durable.',
            impact: { security: -12, availability: 2, logic: -8 },
            consequence: 'Une exception sans responsable ni échéance échappe au contrôle une fois la maintenance terminée.',
            bias: 'Biais commis : oublier la révocation des accès introduits pour le test.',
            next: null,
            recommended: false,
          },
        ],
      },
    ],
  },
];
