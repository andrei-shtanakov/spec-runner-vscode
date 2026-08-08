# TODO — spec-runner-vscode (заведён 2026-07-26)

> Роль в экосистеме: тонкий клиент над CLI/JSON-контрактами `../spec-runner`. Своей
> governance-логики не имеет, спек-файлы и state-DB не пишет — только читает поверхности
> `--json` и диспетчеризует команды. В roadmap экосистемы задач не имеет.
> Стратегический контекст: `../prograph-vault/authored/notes/ecosystem-roadmap.md`
> Реестр: `../prograph-vault/authored/registry/registry.md`
>
> Открытые пункты размечены инлайн-тегами `@owner:` / `@blocked_by:` / `@trigger:` /
> `@id:` по plan-fields v2. Для `@owner:` каноничны `github:<login>`,
> `github-team:<org>/<team>`, `repo:<manifest-key>` и `TBD`; bare handle/role — legacy.
> Теги опциональны и исключены из ключа идентичности пункта в Robin (robin-runtime#27);
> отсутствие тега значит «неизвестно» — выдумывать значение не надо.
>
> ⚠️ **Robin этот файл пока не видит.** `spec-runner-vscode` отсутствует в
> `_ECOSYSTEM_REPOS` (`robin-runtime/src/robin/config.py:18`), то есть репо не зеркалится
> и в знаменатель покрытия (6 из 12 на 2026-07-26) не входит вовсе. Правка — на стороне
> robin-runtime, см. «Расхождения у соседей».

## Текущее состояние

- ✅ **Скаффолд расширения** (`71b5137`): read-model + action-dispatcher — три TreeView
  (Spec / Tasks / Run), gated-действия (Approve/Reject/Regenerate/Generate/Edit),
  run/stop с потоковым stderr в OutputChannel и status-bar.
- ✅ **Version-pin ≥ 2.8.1** (`0dfe737`, `src/schemas.ts:minSpecRunnerVersion`). 2.8.1 —
  первый релиз spec-runner, где `--json` stdout свободен от логов (pre-init structlog →
  stderr) и `costs --json` без `tasks.md` отдаёт валидный пустой payload. Ниже пина
  расширение деградирует в read-only.
- ✅ **Вендоренные контракт-схемы**: `status`, `costs`, `spec-frontmatter`, `json-result`.
  Контрактные тесты есть с обеих сторон — здесь фейковый CLI
  (`test-integration/fixtures/workspace/bin/fake-spec-runner.js`), у spec-runner
  `tests/test_vscode_contract.py`.
- ✅ **Две тестовые прослойки**: unit (vitest, 34 теста) для vscode-free ядра и
  integration (`@vscode/test-electron`, 8 тестов) — реальный extension host против
  фейкового CLI, без Python и LLM.
- ✅ **Generate из файла** (`7461458`, PR #5): `plan --from-file` + QuickPick.
- ✅ **Governance-гейт экосистемы принят** (`b5798f3`, PR #10, ADR-ECO-004 D5):
  `governance / gate` — обязательный чек, CODEOWNERS = `* @andrei-shtanakov`.
- ✅ **CI со сборкой и тестами** (`5fff1f5`, PR #14, 2026-07-26): `.github/workflows/ci.yml`
  гоняет `check-types` → `build` → vitest → `vscode-test` под `xvfb` на каждый PR и на
  push в master. До него governance-гейт был единственным воркфлоу, и три dependency-PR
  подряд отчитались `CLEAN`, ни разу не запустив компилятор.
- 🚧 **Версия 0.1.0 не публиковалась**: в Marketplace расширения нет, ставится вручную
  через `.vsix` с `--force` (версия во время разработки не двигается).
- ✅ **`spec-runner.specPrefix` работает без обхода в расширении**: upstream-фикс
  spec-runner `4ef5787` (#93) сохраняет common-флаг перед субкомандой; живой smoke на
  2.21.0 подтвердил текущий порядок `buildArgs`.

- ✅ **`review`-статус принят и поддержан** (issue #16, slug `revendor-review-status`,
  2026-08-05): spec-runner v2.14.0 добавил промежуточный tasks.md-статус `review` (🔍 —
  гейты пройдены, идёт code review). `costs.schema.json` ре-вендорена (enum +`review`),
  `normalizeStatus` мапит его в `in_progress` (rawStatus сохраняется). До этого статус
  fail-soft показывался как `unknown`. Пин `minSpecRunnerVersion` не тронут — изменение
  аддитивное, старые spec-runner просто не эмитят новый статус.

## Правила ведения

- После выполненной задачи — `[x]` и хеш коммита.
- **Тонкость клиента — инвариант**: расширение не пишет спек-файлы и не трогает state-DB;
  любая мутация идёт через CLI-субкоманду. Логика, которой нет в CLI, здесь не заводится —
  она заводится в `../spec-runner`.
- **Пин бампаем только в связке** с contract-affecting релизом spec-runner, не «за свежесть».
- Пункты уровня команды и кросс-проектные — сюда. Микрошаги реализации сюда не кладём:
  каталога планов в репо нет (в отличие от `../spec-runner` с его `docs/plans/`) — объём
  работ такого не требует, детали живут в описании PR и в коде.
- Инлайн-теги `@owner:` / `@blocked_by:` / `@trigger:` / `@id:` используют plan-fields v2;
  все опциональны. Значение `@id` — стабильный локальный идентификатор пункта,
  уникальный внутри репозитория; полный кросс-репный адрес имеет вид
  `todo://spec-runner-vscode/<id>`.

---

## Активные задачи

### CI и поставка

- [ ] Сделать job `test` обязательным чеком в branch protection для `master` @owner:github:andrei-shtanakov @id:branch-protection-required-test

  Воркфлоу сам по себе мерж не блокирует: красный CI сейчас лишь виден. Правится в
  Settings → Branches, кодом не закрывается.

- [ ] Решить, публикуется ли расширение в Marketplace @owner:github:andrei-shtanakov @id:marketplace-publication-decision

  Сейчас `0.1.0 — unreleased`, `publisher` в манифесте есть, установка руками через
  `.vsix --force` + Reload Window. Если публикация не планируется — зафиксировать это
  явно в README, чтобы `publisher` не читался как обещание.

- [ ] Бампнуть `actions/checkout`, `actions/setup-node`, `actions/cache` на v5 @trigger:"GitHub опубликует v5 всех трёх" @id:github-actions-v5-upgrade

  Сейчас CI пишет annotation: экшены собраны под Node 20 и принудительно запускаются на
  Node 24. На результат не влияет, но шум в каждом прогоне.

### Зависимости

- [ ] `brace-expansion` под `mocha` остаётся уязвим (GHSA-mh99-v99m-4gvg, high) @trigger:"выйдет релиз ветки 2.x выше 5.0.7-эквивалента" @id:brace-expansion-advisory

  Диапазон адвизори `<=5.0.7` покрывает всю ветку 2.x, фикса для неё нет. Dev-only,
  в `dist/extension.js` не попадает (esbuild собирает с `external: ["vscode"]`).
  Предложение `npm audit fix` — даунгрейд `@vscode/test-cli` до 0.0.11 — применять не надо.

---

## Закрыто

- [x] `spec-runner.specPrefix` не доходил до CLI: upstream исправил обе позиции флага @owner:github:andrei-shtanakov @id:spec-prefix-swallow
  (`4ef5787`, spec-runner #93), а smoke на 2.21.0 подтвердил вызов расширения без
  локального workaround.
- [x] Пересмотрен `minSpecRunnerVersion` после публикации 2.10.0 (`58b4002`) @owner:github:andrei-shtanakov @id:min-spec-runner-version-review
  Релиз добавил opt-in lifecycle-команды, но не изменил потребляемые `status` / `costs` /
  `json-result` контракты; минимальный пин остаётся 2.8.1, как требует правило
  «не бампать ради свежести».

---

## Расхождения у соседей (правим не мы — нужен handoff)

Обе находки 2026-07-26, обе в чужих репо, поэтому здесь только зафиксированы.

- **robin-runtime**: `spec-runner-vscode` отсутствует в `_ECOSYSTEM_REPOS`
  (`src/robin/config.py:18`). Репо не зеркалится, в покрытие план-файлов не входит, и этот
  `TODO.md` в дайджест не попадёт. Соседний `spec-runner` в списке есть.
- **prograph-vault**: в реестре (`authored/registry/registry.md:35`) репо описан как
  «VSCode thin client over **dispatcher**/spec-runner action/read contracts». Ссылок на
  `dispatcher` в коде нет ни одной; вероятно, прочитана архитектурная формулировка
  README «read-model + action-dispatcher». Фактически контракты только со `spec-runner`.
