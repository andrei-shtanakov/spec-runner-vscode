# CLAUDE.md

## Язык и тулчейн — этот репо НЕ Python

Единственный TypeScript/npm-репо в экосистеме. Глобальные правила из
`~/.claude/CLAUDE.md` («primary language is Python», `uv`, `pytest`, `ruff`, `pyrefly`,
88 символов) здесь **не применяются** — соответствующих инструментов в проекте нет.
Вместо них:

| Задача | Команда |
|---|---|
| Типы | `npm run check-types` (`tsc --noEmit`; `npm run lint` — тот же tsc) |
| Сборка | `npm run build` (esbuild → `dist/extension.js`) |
| Unit-тесты | `npm test` (vitest) |
| Интеграционные | `npm run test:integration` (`vscode-test`, поднимает настоящий VS Code) |
| Установка зависимостей | `npm ci` (не `npm install` — lockfile авторитетен) |

Линтера/форматтера, кроме `tsc`, нет; не выдумывай `ruff`/`eslint`-шаги и не заводи их
попутно. Если инструмент из глобального CLAUDE.md неприменим — так и скажи, а не подбирай
замену молча.

## Проверка перед коммитом

`check-types` → `build` → `npm test`. Интеграционные — когда тронут extension host,
`package.json` (contributes/activation), CLI-argv или тестовый харнесс. То же самое гоняет
CI (`.github/workflows/ci.yml`, добавлен PR #14), так что расхождений быть не должно.

## Контракт со spec-runner

- Расширение — **тонкий клиент**: читает `--json`-поверхности и диспетчеризует
  субкоманды. Спек-файлы и state-DB не пишет никогда. Логика, которой нет в CLI, заводится
  в `../spec-runner`, не здесь.
- **Version-pin ≥ 2.8.1** (`src/schemas.ts:minSpecRunnerVersion`) — первый релиз с
  log-free `--json` stdout и валидным пустым `costs --json`. Ниже пина — деградация в
  read-only. Бампать **только в связке** с contract-affecting релизом spec-runner.
- Схемы (`status`, `costs`, `spec-frontmatter`, `json-result`) **вендорятся** пиненой
  копией внутрь репо. Контрактные тесты живут с обеих сторон: здесь — фейковый CLI
  (`test-integration/fixtures/workspace/bin/fake-spec-runner.js`, всегда логирует в
  stderr как настоящий), у spec-runner — `tests/test_vscode_contract.py`.
- Песочница для ручной проверки: `../spec-runner-test-vscode` — настоящий проект внутри
  git-репо, поэтому воспроизводит оба исторически ломавших сценария сразу (git-subdir
  warning в stderr + свежая gated-спека без `tasks.md`).
- `.vsix` во время разработки: версия остаётся `0.1.0`, поэтому переустановка требует
  `code --install-extension … --force` + Reload Window. Сборка — `npx @vscode/vsce package`.

## План работ

Открытые пункты уровня команды — в `./TODO.md`, формат инлайн-тегов `@owner:` /
`@blocked_by:` / `@trigger:` описан там же. Микрошаги реализации туда не кладём.

## Repo scope & boundaries

- **Этот репо:** `spec-runner-vscode` — git-корень `all_ai_orchestrators/spec-runner-vscode/`, remote `git@github.com:andrei-shtanakov/spec-runner-vscode.git`.
- **Соседи (READ-ONLY reference):** `../arbiter/`, `../atp-platform/`, `../deployer/`,
  `../discovery/`, `../dispatcher/`, `../Maestro/`, `../libretto/`, `../proctor/`,
  `../prograph/`, `../prograph-vault/`, `../robin-runtime/`, `../robin-toolkit/`,
  `../spec-runner/`, `../spec-runner-test-vscode/`, `../steward/` — их код не редактировать.
  (`Maestro` — именно с заглавной; на macOS регистр прощается, на Linux нет.)
- Нужна правка у соседа → **стоп**: запиши handoff в `../prograph-vault/authored/notes/`
  (кросс-проектное) или `../_cowork_output/` (черновик), не трогай его файлы.
  Известные расхождения у соседей фиксируй в `./TODO.md`, чтобы находка не потерялась.
- Кросс-репные контракты — **вендорить пиненой копией внутрь**, не ссылаться наружу.
- `../_cowork_output/` — dev-only координационный workspace; shipped-код оттуда ничего
  не читает и не резолвит.
- Полное правило (SSOT): `../prograph-vault/authored/rules/repo-boundaries.md`.

## Git workflow (у репо есть remote)

- Ветка `<type>/<slug>` → push → `gh pr create`. **Прямые коммиты в `master` запрещены.**
- После открытия PR — прочитать ревью **GitHub Copilot**: валидные замечания исправлять
  новыми коммитами в ту же ветку; невалидные — ответить с обоснованием, **не применять
  вслепую**; итерировать, пока не останется открытых замечаний. Ревью не всегда
  запрашивается автоматически — если его нет, запросить явно
  (`gh api -X POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`).
- **Не мержить.** Мерж делает пользователь.
- После мержа пользователем: `git switch master && git pull --ff-only`, затем удалить
  влитую ветку (`git branch -d <branch>`) и `git fetch --prune`; убрать прочие влитые
  ветки. Remote-ветку GitHub удаляет сам не всегда — проверять
  `git branch -r --merged master` и добивать `git push origin --delete <branch>`.
- Никогда не делать force-push в общие ветки; не трогать другие репо (см. scope выше).
- Полное правило (SSOT): `../prograph-vault/authored/rules/git-workflow.md`.
