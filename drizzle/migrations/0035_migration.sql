create policy "hr manage hr files" on public.project_files for all to authenticated
  using (project_id = 'hr-documents' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')))
  with check (project_id = 'hr-documents' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')));
create policy "hr manage hr file objects" on storage.objects for all to authenticated
  using (bucket_id = 'dashboard-project-files' and (storage.foldername(name))[1] = 'hr-documents' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')))
  with check (bucket_id = 'dashboard-project-files' and (storage.foldername(name))[1] = 'hr-documents' and (public.is_hr(auth.uid()) or public.has_role(auth.uid(),'admin')));