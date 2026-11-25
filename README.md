# DecisionLab

DecisionLab est un simulateur de décisions. L’hébergement Vercel et Supabase permet aux participants de rejoindre depuis différents appareils, d’attendre le départ de l’organisateur et de partager un classement.

## Mise en ligne sur Vercel

1. Crée un projet Supabase.
2. Dans Supabase, ouvre **SQL Editor**, colle le contenu de [`supabase/schema.sql`](./supabase/schema.sql), puis exécute-le.
3. Envoie ce dossier dans un dépôt GitHub. Dans VS Code, ouvre **Contrôle de code source → Initialiser le dépôt**, puis valide et publie le dépôt sur GitHub.
4. Dans Vercel, choisis **Add New → Project** et importe ce dépôt.
5. Dans **Settings → Environment Variables** du projet Vercel, ajoute :
   - `SUPABASE_URL` : l’URL du projet Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé secrète `service_role` de Supabase. Elle doit rester côté serveur ; ne la préfixe jamais par `VITE_`.
   - `ORGANIZER_CODE` : un code long et privé, connu uniquement de l’organisateur.
6. Déploie ou redéploie le projet après avoir ajouté les variables.
7. Ouvre l’adresse Vercel et affiche le QR code. Les participants le scannent, saisissent un pseudo et attendent. Dans **Accès organisateur**, saisis le code privé et clique **Démarrer pour tout le monde**. Seul un organisateur authentifié voit l’onglet **Créateur de scénario**.

Après le parcours, les scores apparaissent dans le podium partagé. L’organisateur peut créer une nouvelle session pour le groupe suivant.

## Développement local

Copie `.env.example` vers `.env.local`, remplis l’URL Supabase et la clé secrète, puis choisis un code organisateur privé. Lance ensuite :

```powershell
npm.cmd install
npm.cmd run dev
```

En local, l’API et l’application tournent sur le même ordinateur. Pour tester le QR avec un téléphone, ouvre l’adresse **Network** affichée par Vite et connecte le téléphone au même Wi-Fi.

## Règles du parcours

- Le parcours partagé comprend les quatre scénarios intégrés, soit seize questions. Seul l’organisateur authentifié peut créer, importer ou modifier des scénarios personnalisés ; ceux-ci restent locaux à son navigateur et ne sont pas ajoutés au parcours partagé.
- Le chronomètre dure 45 secondes (débutant), 40 (intermédiaire), 35 (avancé) ou 30 (expert). Une question sans réponse est enregistrée comme telle, sans modifier les scores, puis le parcours continue automatiquement.
- La position de la réponse recommandée est mélangée et répartie entre A, B, C et D selon le nombre de choix.
- Le serveur valide l’historique et recalcule les scores à partir des réponses reçues.
- Les pseudos et réponses restent déclaratifs : ce podium n’est pas une preuve d’identité ni un classement inviolable. Une personne peut usurper un pseudo ; n’utilise pas d’informations sensibles.
