CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  doc_number text NOT NULL DEFAULT '',
  branch text NOT NULL DEFAULT 'الرياض',
  issue_date date,
  expiry_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read company docs" ON public.company_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "hr admin write company docs" ON public.company_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
INSERT INTO public.company_documents (doc_type, doc_number, branch, issue_date, expiry_date) VALUES
('سجل تجاري','','الرياض','2023-08-20','2030-01-30'),
('عقد إيجار','20502939842','الرياض','2026-01-18','2030-01-01'),
('غرفة الرياض','845610','الرياض','2023-08-02','2026-08-08'),
('شهادة تصنيف','2025006417','الرياض','2025-08-05','2027-08-05'),
('شهادة هيئة الزكاة والضريبة والجمارك','1027253608','الرياض','2025-01-31','2027-04-30'),
('شهادة المحتوى المحلي','','الرياض','2025-10-02','2026-07-31'),
('شهادة الأيزو','ISO14001 - ISO9001 - ISO45001','الرياض',NULL,'2028-02-03'),
('منشآت','','الرياض','2026-05-30','2027-05-30'),
('شهادة تسجيل في ضريبة القيمة المضافة','','الرياض',NULL,'2030-01-30'),
('الهيئة السعودية للمقاولين','540454044','الرياض',NULL,'2026-08-22');