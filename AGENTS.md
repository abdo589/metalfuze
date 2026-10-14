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
