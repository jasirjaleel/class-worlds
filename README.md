# Class Worlds

A classroom reward game. The teacher rewards students from a phone, and the class's world grows on the big screen. One game, six worlds, no student accounts.

Built with Next.js, Three.js, Supabase (login, Postgres, live updates) and Vercel.

## Set up

1. Create a Supabase project. In **Authentication > Sign In / Providers**, turn off **Allow new users to sign up**. Teachers are added by command instead.
2. Copy `.env.example` to `.env.local` and fill it in from the project.
3. Install and create the tables:

   ```bash
   npm install
   npm run db:migrate
   ```

4. Add a teacher. The temporary password is printed in your terminal, and nothing is emailed. They choose their own password at first sign-in.

   ```bash
   npm run add-teacher -- teacher@school.ae
   ```

5. Run it:

   ```bash
   npm run dev
   ```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run add-teacher -- email` | Adds a teacher and prints a temporary password |
| `npm run add-teacher -- email --reset` | Gives a teacher who forgot their password a new temporary one |
| `npm run seed-demo -- email` | Adds a sample class to that teacher's account, for showing the game to someone |
| `npm run db:generate` | Creates a migration after changing `db/schema.ts` |
| `npm test` | Runs the tests, using an in-memory database |

## How it fits together

- **Points are the truth and worlds are the skin.** `point_events` drives everything, so switching world keeps every student's points.
- **Permissions:** every class request goes through `lib/server/access.ts`, which checks that the signed-in teacher owns the class. The browser can't read the tables directly.
- **Live updates:** after each change the server sends "something changed" on a private Supabase Realtime channel. Screens then fetch the class from our API. If a school network blocks the live channel, screens fetch every 10 seconds instead, and rewards still play.
