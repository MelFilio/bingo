# Bingo

A Vite, React, and TypeScript app with Firebase email/password authentication
and private user profiles in Cloud Firestore.

After authentication, every player must reserve a unique username. The app
stores it on their profile for display during bingo sessions and uses the
`usernames` collection to prevent duplicates.

Players can create or join real-time multiplayer rooms using six-character
codes. The host chooses the winning pattern and manual or automatic calling,
then starts a synchronized 75-ball bingo round. See `GAME_SPEC.md` for the game
rules and Firestore state model.

## Set up Firebase

1. Create a project in the Firebase console.
2. Add a Web app to that project.
3. In **Authentication → Sign-in method**, enable **Email/Password** and
   **Google**. Select a project support email when configuring Google.
4. Create a Cloud Firestore database.
5. Copy `.env.example` to `.env.local` and add the Web app configuration.
6. Deploy `firestore.rules` with the Firebase CLI or paste the rules into the
   Firestore Rules editor.

Firebase Web API keys are identifiers rather than server secrets, but access
must still be protected with Authentication and Firestore Security Rules. Never
put admin credentials or service-account keys in this client application.

## Run locally

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run test
npm run build
```
