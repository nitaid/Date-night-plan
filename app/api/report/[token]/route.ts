import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Hit by the iPhone Shortcut automation "When Grindr is opened".
// POST only, so link previews of the URL can't trigger a reset.
async function report(_req: Request, ctx: RouteContext<"/api/report/[token]">) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ ok: false }, { status: 404 });

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("report_open", { p_token: token });
  if (error) return Response.json({ ok: false }, { status: 500 });
  if (!data) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true });
}

export { report as POST };
