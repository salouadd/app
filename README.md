# DecisionLab

DecisionLab est un simulateur de décisions. L’hébergement Vercel et Supabase permet aux participants de rejoindre depuis différents appareils, d’attendre le départ de l’organisateur et de suivre leur progression individuelle.

## Mise en ligne sur Vercel

1. Crée un projet Supabase.
2. Dans Supabase, ouvre **SQL Editor**, colle le contenu de [`supabase/schema.sql`](./supabase/schema.sql), puis exécute-le.
3. Envoie ce dossier dans un dépôt GitHub. Dans VS Code, ouvre **Contrôle de code source → Initialiser le dépôt**, puis valide et publie le dépôt sur GitHub.
4. Dans Vercel, choisis **Add New → Project** et importe ce dépôt.
5. Dans **Settings → Environment Variables** du projet Vercel, ajoute :
   - `SUPABASE_URL` : l’URL du projet Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé secrète `service_role` de Supabase. Elle doit rester côté serveur ; ne la préfixe jamais par `VITE_`.
   - `ORGANIZER_CODE` : un code long et privé, connu uniquement de l’organisateur.
   - `GROQ_API_KEY` : la clé secrète créée dans le tableau de bord Groq. Elle reste côté serveur, sans préfixe `VITE_`.
6. Déploie ou redéploie le projet après avoir ajouté les variables.
7. Ouvre l’adresse Vercel et affiche le QR code. Les participants le scannent, saisissent un pseudo et attendent. Dans **Accès organisateur**, saisis le code privé et clique **Démarrer pour tout le monde**. Seul un organisateur authentifié voit l’onglet **Créateur de scénario**.

Après chaque réponse, la progression individuelle apparaît dans le quiz et dans le panneau organisateur. À la fin du parcours, chaque participant attend dans une salle dédiée jusqu’à ce que tout le groupe ait terminé. Le classement final est alors affiché par score, puis par temps total; les ex æquo partagent le même rang. Le participant peut aussi consentir à l’envoi de ses réponses à Groq pour l’analyse; le rapport généré est conservé dans la base de l’application et peut être téléchargé en PDF. Réexécute [`supabase/schema.sql`](./supabase/schema.sql) dans l’éditeur SQL Supabase pour ajouter le champ de rapport IA, puis redéploie.

## Développement local

Copie `.env.example` vers `.env.local`, remplis les variables Supabase, ajoute `GROQ_API_KEY` pour activer les rapports IA et choisis un code organisateur privé. Ne partage ni ne publie ces clés. Lance ensuite :

```powershell
npm.cmd install
npm.cmd run dev
```

En local, l’API et l’application tournent sur le même ordinateur. Pour tester le QR avec un téléphone, ouvre l’adresse **Network** affichée par Vite et connecte le téléphone au même Wi-Fi.

## Règles du parcours

- Le parcours partagé comprend quatre scénarios NAC/Zero Trust, continuité NAC, réponse CoA et gouvernance ISO 22301. Chaque mauvaise réponse ou expiration ouvre une question de correction liée au choix; une bonne réponse ramène au parcours principal. Après trois tentatives de correction, le participant reprend le parcours. Le suivi de 0 à 100 % compte les seize décisions principales, pas les questions de correction.
- Le chronomètre dure 45 secondes (débutant), 40 (intermédiaire), 35 (avancé) ou 30 (expert). Une expiration ne rapporte pas de bonne réponse et déclenche la branche de correction.
- La position de la réponse recommandée est mélangée et répartie entre A, B, C et D selon le nombre de choix.
- Le serveur valide le chemin suivi, limite les corrections à trois tentatives et recalcule les résultats à partir des réponses.
- Le rapport final met en évidence des points forts et des axes de progression à partir des décisions, de leurs conséquences, du temps de réponse et des réflexions facultatives. Il ne prétend pas décrire la personnalité du participant.
- Les réponses et réflexions ne sont envoyées à Groq qu’après consentement explicite. Le pseudo et l’identifiant du participant ne sont pas transmis au modèle. Le rapport est stocké dans Supabase avec le résultat. Ne saisissez aucune information personnelle ou sensible.
