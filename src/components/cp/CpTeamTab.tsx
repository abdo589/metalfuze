import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCESS_ROLES, JOBS, cpKeys, type CpMember } from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";
import { Fld } from "./CpOverview";

type Draft = { id?: string; name: string; job: string; phone: string; email: string; manager_id: string; access_role: string };
const blank: Draft = { name: "", job: JOBS[1]!, phone: "", email: "", manager_id: "none", access_role: "viewer" };

export function CpTeamTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: cpKeys.members(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [view, setView] = useState("tree");
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["cp"] });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("الاسم مطلوب");
    const row = {
      project_id: projectId, name: draft.name.trim(), job: draft.job, phone: draft.phone, email: draft.email.trim(),
      access_role: draft.access_role, manager_id: draft.manager_id === "none" ? null : draft.manager_id,
    };
    const { error } = draft.id
      ? await supabase.from("project_members").update(row).eq("id", draft.id)
      : await supabase.from("project_members").insert(row);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    setDraft(null);
    refresh();
  };
  const remove = async (m: CpMember) => {
    if (!confirm(`حذف ${m.name}؟`)) return;
    const { error } = await supabase.from("project_members").delete().eq("id", m.id);
    if (error) return toast.error("تعذر الحذف: " + error.message);
    refresh();
  };
  const edit = (m: CpMember) => setDraft({ id: m.id, name: m.name, job: m.job, phone: m.phone, email: m.email, manager_id: m.manager_id ?? "none", access_role: m.access_role });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} variant="outline">
          <ToggleGroupItem value="tree">الهيكل التنظيمي</ToggleGroupItem>
          <ToggleGroupItem value="table">جدول</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => setDraft({ ...blank })}><Plus className="h-4 w-4" /> إضافة عضو</Button>
      </div>
      {members.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد</p>
        : view === "tree" ? <OrgChart members={members} onEdit={edit} />
        : <MembersTable members={members} onEdit={edit} onRemove={remove} />}
      {draft && <MemberDialog draft={draft} setDraft={setDraft} members={members} onSave={save} />}
    </div>
  );
}

function OrgChart({ members, onEdit }: { members: CpMember[]; onEdit: (m: CpMember) => void }) {
  const children = useMemo(() => {
    const map = new Map<string | null, CpMember[]>();
    const ids = new Set(members.map((m) => m.id));
    for (const m of members) {
      const k = m.manager_id && ids.has(m.manager_id) ? m.manager_id : null;
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return map;
  }, [members]);
  const Node = ({ m, depth }: { m: CpMember; depth: number }) => {
    const kids = depth > 20 ? [] : (children.get(m.id) ?? []);
    return (
      <li className="org-node">
        <button type="button" onClick={() => onEdit(m)} className="inline-block min-w-32 rounded-lg border border-border bg-card px-3 py-2 text-center shadow-sm hover:border-primary">
          <div className="text-sm font-semibold text-foreground">{m.name}</div>
          <div className="text-xs text-primary">{m.job}</div>
        </button>
        {kids.length > 0 && <ul>{kids.map((k) => <Node key={k.id} m={k} depth={depth + 1} />)}</ul>}
      </li>
    );
  };
  return (
    <Card><CardContent className="overflow-x-auto p-4">
      <ul className="org-tree mx-auto w-max">{(children.get(null) ?? []).map((m) => <Node key={m.id} m={m} depth={0} />)}</ul>
    </CardContent></Card>
  );
}

function MembersTable({ members, onEdit, onRemove }: { members: CpMember[]; onEdit: (m: CpMember) => void; onRemove: (m: CpMember) => void }) {
  const lang = useLanguage();
  const byId = new Map(members.map((m) => [m.id, m.name]));
  return (
    <Card><CardContent className="overflow-x-auto p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>الاسم</TableHead><TableHead>الوظيفة</TableHead><TableHead>الجوال</TableHead><TableHead>الإيميل</TableHead><TableHead>المسؤول المباشر</TableHead><TableHead>الصلاحية</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.job}</TableCell>
              <TableCell dir="ltr" className="text-start">{m.phone ? <a href={`tel:${m.phone}`} className="text-primary">{m.phone}</a> : "—"}</TableCell>
              <TableCell dir="ltr" className="text-start">{m.email || "—"}</TableCell>
              <TableCell>{(m.manager_id && byId.get(m.manager_id)) || "—"}</TableCell>
              <TableCell>{(() => { const r = ACCESS_ROLES.find((x) => x.v === m.access_role); return r ? (lang === "en" ? r.en : r.ar) : m.access_role; })()}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Button size="icon" variant="ghost" onClick={() => onEdit(m)} aria-label="تعديل"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onRemove(m)} aria-label="حذف"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function MemberDialog({ draft, setDraft, members, onSave }: { draft: Draft; setDraft: (d: Draft | null) => void; members: CpMember[]; onSave: () => void }) {
  const lang = useLanguage();
  return (
    <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{draft.id ? "تعديل عضو" : "إضافة عضو"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld l="الاسم"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Fld>
          <Fld l="الوظيفة">
            <Select value={draft.job} onValueChange={(v) => setDraft({ ...draft, job: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JOBS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld l="رقم الجوال"><Input type="tel" dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Fld>
          <Fld l="الإيميل"><Input type="email" dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Fld>
          <Fld l="المسؤول المباشر">
            <Select value={draft.manager_id} onValueChange={(v) => setDraft({ ...draft, manager_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— لا يوجد —</SelectItem>
                {members.filter((m) => m.id !== draft.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.job})</SelectItem>)}
              </SelectContent>
            </Select>
          </Fld>
          <Fld l="الصلاحية في المشروع">
            <Select value={draft.access_role} onValueChange={(v) => setDraft({ ...draft, access_role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCESS_ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{lang === "en" ? r.en : r.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
        </div>
        <DialogFooter><Button onClick={onSave}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
