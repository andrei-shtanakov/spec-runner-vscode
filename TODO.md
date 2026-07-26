# TODO — spec-runner-vscode (заведён 2026-07-26)

> Роль в экосистеме: тонкий клиент над CLI/JSON-контрактами `../spec-runner`. Своей
> governance-логики не имеет, спек-файлы и state-DB не пишет — только читает поверхности
> `--json` и диспетчеризует команды. В roadmap экосистемы задач не имеет.
> Стратегический контекст: `../prograph-vault/authored/notes/ecosystem-roadmap.md`
> Реестр: `../prograph-vault/authored/registry/registry.md`
>
> Открытые пункты размечены инлайн-тегами `@owner:` / `@blocked_by:` / `@trigger:` по
> формату из `../_cowork_output/2026-07-26-plan-fields-and-todo-coverage-handoff.md` §3.
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
- ⚠️ **`spec-runner.specPrefix` не работает** — см. чекбокс ниже.

## Правила ведения

- После выполненной задачи — `[x]` и хеш коммита.
- **Тонкость клиента — инвариант**: расширение не пишет спек-файлы и не трогает state-DB;
  любая мутация идёт через CLI-субкоманду. Логика, которой нет в CLI, здесь не заводится —
  она заводится в `../spec-runner`.
- **Пин бампаем только в связке** с contract-affecting релизом spec-runner, не «за свежесть».
- Пункты уровня команды и кросс-проектные — сюда; микрошаги реализации — в спеки/`docs/plans/`.
- Инлайн-теги `@owner:` / `@blocked_by:` / `@trigger:` — формат из handoff §3, все опциональны.

---

## Активные задачи

### Контракт с spec-runner

- [ ] `spec-runner.specPrefix` не доходит до CLI — настройка сейчас мертва @owner:andrei @blocked_by:spec-runner#spec-prefix-swallow

  Проверено 2026-07-26 на установленном spec-runner 2.9.0: `--spec-prefix` объявлен и на
  top-level парсере, и в parent-парсере `common`, поэтому субпарсер затирает значение
  своим `default=""`. `buildArgs` (`src/cli.ts:33`) ставит флаг **перед** субкомандой —
  ровно тот порядок, который проглатывается:

  | argv | `spec_prefix` |
  |---|---|
  | `--spec-prefix=phase2- run` (наш порядок) | `''` |
  | `run --spec-prefix=phase2-` | `'phase2-'` |

  Односторонне у себя не чинится: семейство `spec` (`approve`/`reject`/`check`) не
  отнаследовано от `common` и флага не имеет вообще, поэтому простой перенос флага
  за субкоманду сломает gated-действия. Ждём фикс в spec-runner, там пункт заведён.

- [ ] Пересмотреть `minSpecRunnerVersion` (сейчас 2.8.1), когда 2.10.0 реально появится на PyPI @owner:andrei @blocked_by:spec-runner#tag-v2.10.0 @trigger:"2.10.0 опубликован и содержит изменения read-поверхностей"

  У spec-runner код и CHANGELOG 2.10.0 в master (`a24aba5`), но тега нет, а `publish.yml`
  триггерится только по `on.push.tags`, поэтому `pip install spec-runner` даёт 2.9.0.
  Пока так — пин честен и трогать его незачем.

### CI и поставка

- [ ] Сделать job `test` обязательным чеком в branch protection для `master` @owner:andrei

  Воркфлоу сам по себе мерж не блокирует: красный CI сейчас лишь виден. Правится в
  Settings → Branches, кодом не закрывается.

- [ ] Решить, публикуется ли расширение в Marketplace @owner:andrei

  Сейчас `0.1.0 — unreleased`, `publisher` в манифесте есть, установка руками через
  `.vsix --force` + Reload Window. Если публикация не планируется — зафиксировать это
  явно в README, чтобы `publisher` не читался как обещание.

- [ ] Бампнуть `actions/checkout`, `actions/setup-node`, `actions/cache` на v5 @trigger:"GitHub опубликует v5 всех трёх"

  Сейчас CI пишет annotation: экшены собраны под Node 20 и принудительно запускаются на
  Node 24. На результат не влияет, но шум в каждом прогоне.

### Зависимости

- [ ] `brace-expansion` под `mocha` остаётся уязвим (GHSA-mh99-v99m-4gvg, high) @trigger:"выйдет релиз ветки 2.x выше 5.0.7-эквивалента"

  Диапазон адвизори `<=5.0.7` покрывает всю ветку 2.x, фикса для неё нет. Dev-only,
  в `dist/extension.js` не попадает (esbuild собирает с `external: ["vscode"]`).
  Предложение `npm audit fix` — даунгрейд `@vscode/test-cli` до 0.0.11 — применять не надо.

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
