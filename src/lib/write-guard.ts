/** Server-side read-only check for server functions that write with the admin client (which bypasses RLS). */
export async function assertWritable(ctx: { supabase: { rpc: (fn: "can_write", args: { _uid: string }) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("can_write", { _uid: ctx.userId });
  if (error || data !== true) throw new Error("هذا الحساب للعرض فقط — لا يمكنك التعديل");
}
