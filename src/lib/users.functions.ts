import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN = "metalfuze.local";

export type AppUser = { id: string; username: string; name: string; createdAt: string; lastSignIn: string | null };

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AppUser[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error("تعذر تحميل المستخدمين");
    return data.users.map((u) => ({
      id: u.id,
      username: (u.email ?? "").split("@")[0] ?? "",
      name: (u.user_metadata?.["display_name"] as string) || (u.email ?? ""),
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; name: string; password: string }) => {
    const username = String(d.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("اسم المستخدم: 3-30 حرف إنجليزي/أرقام");
    const name = String(d.name ?? "").trim().slice(0, 80);
    if (!name) throw new Error("الاسم مطلوب");
    const password = String(d.password ?? "");
    if (password.length < 8 || password.length > 72) throw new Error("كلمة السر 8 أحرف على الأقل");
    return { username, name, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.username}@${DOMAIN}`,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.name },
    });
    if (error) return { ok: false as const, error: error.message.includes("already") ? "اسم المستخدم مستخدم بالفعل" : error.message.includes("weak") || error.message.includes("pwned") ? "كلمة السر ضعيفة أو مسربة، اختر غيرها" : "تعذر إنشاء الحساب" };
    return { ok: true as const };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; password: string }) => {
    const password = String(d.password ?? "");
    if (password.length < 8 || password.length > 72) throw new Error("كلمة السر 8 أحرف على الأقل");
    return { id: String(d.id), password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) return { ok: false as const, error: "تعذر تغيير كلمة السر (قد تكون ضعيفة)" };
    return { ok: true as const };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    if (data.id === context.userId) return { ok: false as const, error: "لا يمكنك حذف حسابك الحالي" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) return { ok: false as const, error: "تعذر حذف الحساب" };
    return { ok: true as const };
  });
