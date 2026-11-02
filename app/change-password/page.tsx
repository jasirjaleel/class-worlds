"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthState } from "@/app/auth-actions";

export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePasswordAction, undefined);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <p className="cw-eyebrow">Class Worlds</p>
      <h1 className="cw-title mt-2 text-4xl text-white">Choose a password</h1>
      <p className="mt-3 text-sm text-muted">Only you should know it. Use at least 8 characters.</p>

      <form action={action} className="cw-panel mt-6 flex flex-col gap-4 p-5">
        <label className="block text-sm font-semibold text-white">
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className="cw-input mt-1.5" />
        </label>
        <label className="block text-sm font-semibold text-white">
          Type it again
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className="cw-input mt-1.5" />
        </label>
        {state?.error ? (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="cw-menu-btn cw-menu-btn-primary !justify-center">
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </main>
  );
}
