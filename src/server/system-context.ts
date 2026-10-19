import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** Caller-scoped client: RLS applies, so the advisor only sees what this user may see. */
export function createCallerClient(token: string) {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase environment variable(s)');
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const MAX_CHARS = 140_000;
const fail = (v: unknown) => (Array.isArray(v) ? v : []);

/** Compact live snapshot of company-wide data, fetched with the caller's own session. */
export async function buildSystemSnapshot(sb: ReturnType<typeof createCallerClient>): Promise<string> {
  const [hr, employees, residencies, leaveRequests, leaveTypes, settlements, attendance, devices] = await Promise.all([
    sb.from('hr_records').select('id,sheet,data').in('sheet', ['employees', 'documents', 'advances', 'commissions']).order('sort').limit(1200).then((r) => fail(r.data)),
    sb.from('employees').select('*').limit(200).then((r) => fail(r.data)),
    sb.from('residencies').select('*').limit(300).then((r) => fail(r.data)),
    sb.from('leave_requests').select('*').order('start_date', { ascending: false }).limit(300).then((r) => fail(r.data)),
    sb.from('leave_types').select('*').then((r) => fail(r.data)),
    sb.from('settlements').select('*').order('created_at', { ascending: false }).limit(200).then((r) => fail(r.data)),
    sb.from('attendance_logs').select('device_user_id,punched_at,source,status,distance_m,site_name').order('punched_at', { ascending: false }).limit(500).then((r) => fail(r.data)),
    sb.from('attendance_devices').select('serial_number,name,approved,last_seen').then((r) => fail(r.data)),
  ]);
  const snapshot = {
    employees_table: employees,
    hr_records: hr,
    residencies,
    leave_requests: leaveRequests,
    leave_types: leaveTypes,
    settlements,
    attendance_logs: attendance,
    attendance_devices: devices,
  };
  return JSON.stringify(snapshot).slice(0, MAX_CHARS);
}
