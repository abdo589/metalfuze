create policy "hr manages est employee files" on public.project_files for all to authenticated
  using (project_id like 'est-emp-%' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')))
  with check (project_id like 'est-emp-%' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')));
create policy "hr manages est employee storage" on storage.objects for all to authenticated
  using (bucket_id = 'dashboard-project-files' and (storage.foldername(name))[1] like 'est-emp-%' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')))
  with check (bucket_id = 'dashboard-project-files' and (storage.foldername(name))[1] like 'est-emp-%' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')));