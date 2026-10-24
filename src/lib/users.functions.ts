import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN = "metalfuze.local";

/** Account settings belong to the developer (Eng Abdelrhman) only. */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "developer" });
  if (!data) throw new Error("إعدادات الحسابات متاحة للمبرمج فقط");
}

/** Records an account change; never stores passwords. */
async function audit(ctx: { userId: string; claims: unknown }, targetId: string | null, action: string, details = "") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const c = ctx.claims as { email?: string; user_metadata?: { display_name?: string } };
  let target_name = "";
  if (targetId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(targetId);
    target_name = (data.user?.user_metadata?.["display_name"] as string) || data.user?.email || "";
  }
  await supabaseAdmin.from("account_audit").insert({
    actor_id: ctx.userId, actor_name: c.user_metadata?.display_name || (c.email ?? "").split("@")[0] || "",
    target_id: targetId, target_name, action, details,
  });
}

export const ASSIGNABLE_ROLES = ["admin", "hr", "viewer", "manager", "accountant", "executive", "mail", "sales", "developer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type AppUser = { id: string; username: string; name: string; createdAt: string; lastSignIn: string | null; roles: string[]; banned: boolean };

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
      banned: !!(u as { banned_until?: string }).banned_until && new Date((u as { banned_until?: string }).banned_until!).getTime() > Date.now(),
    }));
  });

/** Minimal people list (id + name) for HR/admin pickers such as department leave approvers. */
export const listUserNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string }[]> => {
    let ok = false;
    for (const role of ["admin", "hr", "developer"]) {
      const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: role as never });
      if (data) { ok = true; break; }
    }
    if (!ok) throw new Error("غير مسموح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error("تعذر تحميل المستخدمين");
    return data.users.map((u) => ({ id: u.id, name: (u.user_metadata?.["display_name"] as string) || (u.email ?? "") }));
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
    const { data: made, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.username}@${DOMAIN}`,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.name },
    });
    if (!error) await audit(context, made.user?.id ?? null, "create", data.username);
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
    await audit(context, data.id, "password");
    return { ok: true as const };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "لا يمكنك حذف حسابك الحالي" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await audit(context, data.id, "delete");
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
    const { data: old } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const rows = data.role === "developer" ? ["developer", "admin"] : [data.role];
    const { error } = await supabaseAdmin.from("user_roles").insert(rows.map((role) => ({ user_id: data.id, role: role as AssignableRole })));
    if (error) return { ok: false as const, error: "تعذر حفظ الصلاحية" };
    await audit(context, data.id, "role", `${(old ?? []).map((r) => r.role).join("+") || "—"} → ${data.role}`);
    return { ok: true as const };
  });

async function forceOut(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("account_flags").upsert({ user_id: id, force_logout_at: new Date().toISOString(), updated_at: new Date().toISOString() });
}

export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; banned: boolean }) => ({ id: String(d.id), banned: !!d.banned }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "لا يمكنك إيقاف حسابك" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.banned ? "876000h" : "none" });
    if (error) return { ok: false as const, error: "تعذر تحديث الحساب" };
    if (data.banned) await forceOut(data.id);
    await audit(context, data.id, data.banned ? "ban" : "unban");
    return { ok: true as const };
  });

export const forceSignOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "لا يمكنك إخراج حسابك" };
    await forceOut(data.id);
    await audit(context, data.id, "force_logout");
    return { ok: true as const };
  });
