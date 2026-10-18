CREATE TABLE public.residencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL, job text, nationality text, iqama_no text,
 iqama_expiry date, iqama_fee numeric, permit_expiry date, permit_fee numeric,
 insurance_expiry date, contract_expiry date,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residencies TO authenticated;
GRANT ALL ON public.residencies TO service_role;
ALTER TABLE public.residencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read residencies" ON public.residencies FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));
CREATE POLICY "Editors write residencies" ON public.residencies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid())) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid()));
INSERT INTO public.residencies(name,job,nationality,iqama_no,iqama_expiry,iqama_fee,permit_expiry,permit_fee,insurance_expiry,contract_expiry) VALUES
('نجلا عساف طلايع','مندوب مبيعات','لبناني','2191641253','2027-03-02',163,'2027-03-02',2125,'2027-03-03','2027-02-08'),
('هشام ملاذ - محروس','مدير عام','سوري','2227499577','2026-09-27',163,'2026-09-27',2125,'2026-10-04','2026-12-08'),
('هيثم محمد سعيد احمد درياس','مدير تطوير','أردني','2287724534','2026-08-09',163,'2026-08-09',2125,'2027-04-13','2027-05-01'),
('محمد طاهر السيد على','مهندس مدني','مصر','2539729992','2026-12-13',163,'2026-12-13',2125,'2026-08-17','2026-08-15'),
('IAN RAY DIZON NAPIGKIT','مصمم أول','الفلبين','2556683486','2026-11-19',163,'2026-11-19',2125,'2027-04-13','2027-02-10'),
('HASEEB TARIQ TARIQ MEHMOOD','عامل تحميل و تنزيل','باكستان','2572075923','2026-10-25',163,'2026-10-25',2125,'2026-10-04','2028-01-13'),
('MUHAMMAD AZEEM MUHAMMAD SALEEM','عامل تحميل و تنزيل','باكستان','2572075980','2026-11-19',163,'2026-11-19',2125,'2026-10-04','2026-09-08'),
('هاله حسن طاهر الخميسى','مندوب مبيعات','مصر','2591326232','2026-11-23',163,'2026-11-23',2125,'2026-08-17','2026-08-15'),
('IFTIKHAR ALI MUHAMMAD MISKEEN KHAN','محاسب','باكستان','2618905570','2026-12-27',163,'2026-12-27',2125,'2027-04-08','2027-02-15'),
('MUHAMMAD TALHA MUHAMMAD YOUNAS','أخصائي تسويق','باكستان','2625495102','2027-02-08',163,'2027-02-08',2125,'2027-04-08','2027-03-13'),
('USMAN ALI MUHAMMAD ARIF','مهندس سلامه','باكستان','2629011731','2027-03-22',163,'2027-03-22',NULL,'2027-04-08','2027-02-18');