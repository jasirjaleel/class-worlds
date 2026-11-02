"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signInAction, type AuthState } from "@/app/auth-actions";

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const next = useSearchParams().get("redirect_url") ?? "/";
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, undefined);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <p className="cw-eyebrow">Class Worlds</p>
      <h1 className="cw-title mt-2 text-4xl text-white">Teacher sign in</h1>

      <form action={action} className="cw-panel mt-6 flex flex-col gap-4 p-5">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-white">
          Email
          <input name="email" type="email" autoComplete="email" defaultValue={state?.email} required className="cw-input mt-1.5" />
        </label>
        <label className="block text-sm font-semibold text-white">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="cw-input mt-1.5" />
        </label>
        {state?.error ? (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="cw-menu-btn cw-menu-btn-primary !justify-center">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">Forgot your password, or need an account? Ask the person who set up Class Worlds for your school.</p>
      <p className="mt-4 flex gap-4 text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:text-white">
          Back to menu
        </Link>
        <Link href="/privacy" className="text-muted underline underline-offset-2 hover:text-white">
          Privacy
        </Link>
      </p>
    </main>
  );
}
