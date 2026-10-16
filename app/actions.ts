"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinClub(_prev: string | null, form: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_club", {
    p_name: String(form.get("name") ?? ""),
    p_code: String(form.get("code") ?? "").trim(),
    p_emoji: String(form.get("emoji") ?? ""),
  });
  if (error) return error.message.includes("invite") ? "קוד הזמנה שגוי" : "משהו השתבש, נסה שוב";
  redirect("/settings?welcome=1");
}

export async function reportSelf() {
  const supabase = await createClient();
  await supabase.rpc("report_self");
  revalidatePath("/", "layout");
}

export async function rotateToken() {
  const supabase = await createClient();
  await supabase.rpc("rotate_report_token");
  revalidatePath("/settings");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
