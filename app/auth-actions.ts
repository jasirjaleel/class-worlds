"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safeNext";
import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; email?: string } | undefined;

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z.string().min(1, "Please enter your password."),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match." });

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (error) return { error: "Wrong email or password.", email };
  redirect(safeNext(formData.get("next")));
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { must_change_password: false },
  });
  if (error) return { error: error.code === "same_password" ? "Choose a different password." : "That didn't work. Please try again." };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
