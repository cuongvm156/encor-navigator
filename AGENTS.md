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

## Project rules (mandatory)

- Read `PRD.md` and `ARCHITECTURE.md` before changing the project.
- Do not implement features outside the approved sprint.
- Do not replace `HTMLAudioElement` with the Web Audio API or third-party audio
  player libraries without explicit approval.
- Never automatically clear IndexedDB.
- Use database versioning and explicit migrations.
- Keep course / chapter content data-driven.
- Keep reading and audio progress independent.
- Reading progress uses `maxPageReached`; resume uses `lastPage`.
- Audio progress uses `maxPosition`; resume uses `currentTime`.
- Central progress weights (60% reading / 40% audio) stay configurable in
  `src/features/progress/weights.ts` — no duplicated formulas.
- Avoid large unrelated refactors.
- Run the build (`npm run build`) after modifications.
- Never claim iPhone lock-screen playback is verified unless it was tested on a
  real iPhone.
