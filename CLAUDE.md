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
`@blocked_by:` / `@trigger:` / `@id:` описан там же. Микрошаги реализации туда не
кладём: каталога планов в репо нет, детали живут в описании PR и в коде.

## Repo scope & boundaries

- **Этот репо:** `spec-runner-vscode` — git-корень `all_ai_orchestrators/spec-runner-vscode/`, remote `git@github.com:andrei-shtanakov/spec-runner-vscode.git`.
- **Соседи (READ-ONLY reference):** все остальные подпроекты воркспейса — их код не
  редактировать. Состав флота — `ai-orchestrators-workspace/workspace-manifest.toml`
  (SSOT); рукописные списки соседей в CLAUDE.md не ведём — они дрейфуют.
- **Канон имени репо = имя каталога после обычного `git clone`** (`maestro`, `libretto`).
- Нужна правка у соседа → **стоп**: запиши handoff в `../prograph-vault/authored/notes/`
  (кросс-проектное) или `../_cowork_output/` (черновик), не трогай его файлы.
- Кросс-репные контракты — **вендорить пиненой копией внутрь**, не ссылаться наружу.
- Известные расхождения у соседей фиксируй в `./TODO.md`, чтобы находка не потерялась.
- Полное правило (SSOT): `../prograph-vault/authored/rules/repo-boundaries.md`.

## Git workflow (у репо есть remote)

- Ветка `<type>/<slug>` → push → `gh pr create`. **Прямые коммиты в `master`
  запрещены**, как и локальный мерж ветки в `master` в обход PR.
- **Ревью PR — терминальный прогон от ai-prosto** (дефолт с 2026-08-28):
  `sh ../devtools/review-pr.sh <repo> <pr> --dry-run`, затем без `--dry-run` — вердикт публикуется
  PR-ревью. Находки отрабатывать как обычно: валидное — фикс-коммитом,
  невалидное — ответить с обоснованием, не применять вслепую. CI-гейт
  codex-review (где есть) — advisory-фолбэк по лейблу `codex-review`, его
  красноту/зависание не перегонять. **Copilot по умолчанию не запрашивать** —
  только по явной просьбе владельца. SSOT: `../prograph-vault/authored/rules/git-workflow.md`.
- **Мерж — агент по умолчанию** (ADR-ECO-011 «DarkFactory», ратифицирован 2026-08-30):
  при approve ревью-контура и зелёных обязательных проверках PR мержит агент —
  `gh pr merge` **от учётки ai-prosto** (`merged_by` — наблюдаемый различитель
  agent/human, аудит `gh pr list --json mergedBy`) — и выполняет хвост чистки ниже.
  Request-changes или неприбывшее включённое ревью = `unknown` ⇒ мерж не выполняется,
  PR остаётся человеку. Человеческий мерж — opt-in: строка `Мерж: человек` в этой
  секции (здесь НЕ объявлена) либо `merge_policy` экосистемного конфига. **Всегда
  человеку, без переопределения:** PR по authority-root путям (ADR-ECO-004 I2) и PR
  без предъявленного evidence базового слоя.
- После мержа (кем бы то ни было): `git switch master && git pull --ff-only`, затем удалить
  влитую ветку в **обеих половинах**: локально `git branch -d <ветка>` (после squash-мержа
  `-d` откажется — сверить, что `git diff master <ветка>` пуст, и удалить
  `git branch -D <ветка>`) и на origin
  `git push origin --delete <ветка>`, если GitHub не удалил сам; затем `git fetch --prune`.
- Никогда не делать force-push в общие ветки; не трогать другие репо (см. scope выше).
- Полное правило (SSOT): `../prograph-vault/authored/rules/git-workflow.md`.

## Входящие запросы (inbox)

В начале работы проверь входящие: `gh issue list --label inbox --state open`.
Issue с лейблом `inbox` — запрос от соседнего репо, ещё **не** пункт плана.
Принять = завести пункт в `TODO.md` с указанным `slug:`; принял под другим
именем — поправь `slug:` в теле issue.
Отказать = `gh issue close --reason "not planned"`.
Нужна работа в соседнем репо — не редактируй его: заведи там issue
(`slug:` + `from:` + проза). Правило: ADR-ECO-006 — канон в `ecosystem-kb`
(каталог `prograph-vault/` в корне воркспейса),
`authored/decisions/2026-07-28-adr-eco-006-cross-repo-issue-inbox.md`.

Исходящее ожидание — вторая половина того же ритуала: «ждём соседа» существует
**только** как чекбокс `TODO.md` с `@blocked_by:todo://<repo>/<id>` (переходно —
`<repo>#<номер>`); память сессий, заметки и handoff-доки — лишь зеркало. Находка
PF-BLOCKER-STALE по этому репо = «ожидание доставлено — действуй или переставь тег».
Правило (SSOT): `../prograph-vault/authored/rules/cross-repo-waits.md`.

## `../_cowork_output/` — dev-only

Координационный dev-scratch воркспейса; у пользователей и клонов проекта его НЕТ.
Shipped/runtime-код никогда не читает и не резолвит пути под ним; кросс-репные
контракты вендорятся пиненой копией внутрь, не ссылкой наружу. Ссылаться на него
могут только dev-тулинг самого воркспейса и документация. Канонические факты живут
в репо-владельце (пример: SSOT agents-catalog — `atp-platform/method/agents-catalog.toml`,
ADR-ECO-003). Полное правило (SSOT): `../prograph-vault/authored/rules/cowork-output.md`.
