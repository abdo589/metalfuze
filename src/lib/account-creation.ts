type Result = { ok: true } | { ok: false; error: string };
type Created = { ok: true; id: string } | { ok: false; error: string };
type AccountInput = { name: string; username: string; password: string; role: string };

/** Assign by the returned auth ID, never a lossy username/email lookup. */
export async function createAccountWithRole(
  input: AccountInput,
  create: (args: { data: Omit<AccountInput, "role"> }) => Promise<Created>,
  setRole: (args: { data: { id: string; role: string } }) => Promise<Result>,
): Promise<Result> {
  const { role, ...data } = input;
  const created = await create({ data });
  if (!created.ok) return created;
  const assigned = await setRole({ data: { id: created.id, role } });
  return assigned.ok ? assigned : { ok: false, error: "تم إنشاء الحساب لكن تعذر حفظ الصلاحية؛ حددها من قائمة الحسابات." };
}

/** Role-less accounts must not appear to have an assigned manager role. */
export const assignedAccountRole = (roles: string[]) => roles.includes("developer") ? "developer" : roles[0] ?? "";