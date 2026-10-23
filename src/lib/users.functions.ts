import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN = "metalfuze.local";

/** Account settings belong to the developer (Eng Abdelrhman) only. */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "developer" });
  if (!data) throw new Error("إعدادات الحسابات متاحة للمبرمج فقط");
}

export const ASSIGNABLE_ROLES = ["admin", "hr", "viewer", "manager", "accountant", "executive", "mail", "sales", "developer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type AppUser = { id: string; username: string; name: string; createdAt: string; lastSignIn: string | null; roles: string[] };

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error("تعذر تحميل المستخدمين");
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return data.users.map((u) => ({
      roles: (roleRows ?? []).filter((r) => r.user_id === u.id).map((r) => String(r.role)),
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
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) return { ok: false as const, error: "تعذر تغيير كلمة السر (قد تكون ضعيفة)" };
    return { ok: true as const };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "لا يمكنك حذف حسابك الحالي" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) return { ok: false as const, error: "تعذر حذف الحساب" };
    return { ok: true as const };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; role: string }) => {
    const role = String(d.role) as AssignableRole;
    if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("صلاحية غير معروفة");
    return { id: String(d.id), role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId && data.role !== "developer") return { ok: false as const, error: "لا يمكنك إزالة صلاحية المبرمج من حسابك" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // One main permission per account; the developer keeps admin alongside so existing data access stays.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const rows = data.role === "developer" ? ["developer", "admin"] : [data.role];
    const { error } = await supabaseAdmin.from("user_roles").insert(rows.map((role) => ({ user_id: data.id, role: role as AssignableRole })));
    if (error) return { ok: false as const, error: "تعذر حفظ الصلاحية" };
    return { ok: true as const };
  });
