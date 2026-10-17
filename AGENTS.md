<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Import uploaded brand imagery through Lovable Assets pointers; keep only the resized favicon in public so branding stays lightweight and tab icons remain directly accessible.
- Light and dark mode are both driven by the CSS variables in `src/styles.css` (`:root` = light, `.dark` = dark); never hardcode colors in components so both modes stay correct.
- The chosen mode is saved in localStorage and applied by an inline `<head>` script before paint; keep that script and `suppressHydrationWarning` on `<html>` when editing the root shell.
- AI assistant: client sends current dashboard projects to /api/chat (server route, Lovable AI Gateway Responses via src/server/ai); chat threads live in localStorage (src/lib/threads.ts) because project data is browser-local too.
- Company PDFs use a shared browser-only export helper and button: capture the print layout and paginate at row boundaries to omit browser URL footers and avoid cutting rows.
- Use the shared i18n store and translation function for labels, dates, dialogs and export headings; keep user-entered names, project links, notes and credentials unchanged so language switching never changes business data.
- Period project reports select projects whose scheduled dates overlap the calendar period (Monday-start weeks); undated projects remain included, and financial/progress figures are explicitly current cumulative snapshots, not fabricated historical movements.
- Employees and attendance live in Lovable Cloud tables (employees, attendance_devices, attendance_logs); ZKTeco devices push via ADMS to the fixed /iclock/cdata route, which stores punches only for admin-approved serial numbers.
