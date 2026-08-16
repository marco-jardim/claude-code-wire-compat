# Plano: Acompanhamento de Upstream — Claude Code 2.1.195 → 2.1.222

- **Repositório:** `@tormentalabs/claude-code-wire-compat`
- **Working directory:** `D:\git\claude-code-wire-compat`
- **Plataforma:** win32 · Shell: pwsh
- **Branch base:** `main` @ `6c25056`
- **Versão do pacote na abertura do plano:** `0.1.0`
- **Data:** 2026-08-05
- **Objetivo:** deixar de ser um pin estático de `2.1.195` e passar a acompanhar upstream de forma sustentável, entregando suporte a `2.1.222` como primeiro exercício da nova capacidade.

> **⚠️ ADENDO 2026-08-15 — plano reanalisado antes de qualquer implementação.**
> O upstream avançou de `2.1.222` para `2.1.233` (dist-tags: `latest`/`next` = `2.1.233`, `stable` = `2.1.224`) entre a escrita deste plano e o início da execução. Nenhuma wave foi iniciada (HEAD ainda em `6c25056`). A reanálise binária completa 222→233 está na **Seção 10**, que **retarget-eia o plano para `2.1.233`** e emenda D6/D7, as Fases 2.2/2.3/3.2 e os riscos R6/R12. Onde qualquer seção anterior disser `2.1.222`, leia `2.1.233` com as emendas da Seção 10.

---

## 0. Diretivas permanentes de execução

Estas diretivas valem para **todo** o plano e não podem ser relaxadas por conveniência.

### 0.1 Execução contínua

> **Execute o plano iterando entre cada wave sem interrupções.**
> Não pare para pedir confirmação entre fases, entre tasks ou ao final de uma wave.
> Pare **somente** nestes três casos:
>
> 1. **Ambiguidade que exige decisão humana** — uma escolha de produto/arquitetura/licenciamento que não está resolvida na Seção 2 e cuja escolha errada gera retrabalho estrutural.
> 2. **Problema crítico** — perda de dado, regressão de comportamento de wire que não se explica, falha de segurança, violação de licença.
> 3. **Problema bloqueante** — dependência externa indisponível, gate impossível de satisfazer sem mudar contrato público não acordado.
>
> Em qualquer um dos três: pare, escreva o problema em `docs/plans/BLOCKERS.md` com evidência (comando + saída + arquivo:linha), e escale ao humano com uma recomendação e no mínimo duas opções.
>
> Falha de teste **não** é bloqueio. Falha de teste é trabalho. Corrija e siga.
> Achado de QA review **não** é bloqueio. É trabalho. Corrija e siga.

### 0.2 Commit often

- Commit ao final de **cada subtask** que deixa a árvore verde. Nunca acumule mais de ~150 linhas de diff não commitadas.
- Formato: **Conventional Commits** + **DCO signoff** (`git commit -s`), conforme `CONTRIBUTING.md:7,17`.
- Mensagens públicas neutras — sem referência a modelos de IA, a este plano, ou a agentes.
- Prefixos por tipo de trabalho:
  - `refactor:` mudanças behavior-preserving (Wave 1)
  - `feat:` novo profile / nova capacidade (Wave 2+)
  - `test:` testes novos ou ampliados
  - `docs:` documentação e evidência
  - `chore:` tooling, scripts, CI
  - `fix:` correção de achado de QA review
- **Nunca** commitar: credenciais, `coverage/`, `dist/`, tarballs, evidência gerada (`.com466-evidence/` já é interno — não expandir), dumps de binário.
- Um commit **nunca** deixa a árvore vermelha. Se precisar de um estado intermediário quebrado, use um único commit maior.

### 0.3 Branching

- Branch de trabalho por wave: `feat/upstream-2.1.222-wave-N`.
- Merge para `main` só ao final de cada wave, após o QA review da última fase da wave passar.
- Nunca force-push em `main`.

### 0.4 Gates obrigatórios

Antes de qualquer commit que toque `src/`, `test/`, `scripts/` ou `package.json`:

```
npm run lint
npm run typecheck
npm test
npm run build
```

Antes de fechar qualquer fase, adicione:

```
npm run test:coverage
npm run pack:check
npm run test:pack
npx vitest run test/drift
```

`npm run drift:check` é gate **local** e só roda se o checkout irmão `D:\git\opencode-anthropic-fix` existir. Quando ausente ele sai com código 2 e `SOURCE_UNAVAILABLE` — isso é comportamento correto e **não deve ser suprimido nem contornado** (`CONTRIBUTING.md:15`).

---

## 1. Estado atual — o que já foi verificado

### 1.1 Fidelidade do port

O repositório é um port **byte-exato** de `2.1.195`. Verificado por extração direta do binário Bun-compilado oficial (`@anthropic-ai/claude-code-win32-x64`). Superfícies conferidas e idênticas: registro de betas (28 entradas, mesma ordem), catálogo de modelos (14 ids, mesma ordem), arrays de `capabilities` por modelo, tabela de `max_output_tokens`, versão do SDK (`0.94.0`), `anthropic-version` (`2023-06-01`), endpoints, User-Agent, `x-app`, conjunto `x-stainless-*`, ordem de merge de headers, `anthropic-client-platform`.

**Nenhum bug de port encontrado.** Toda divergência é drift de upstream.

### 1.2 A camada de transporte não mudou

Entre `2.1.195` e `2.1.222` (27 releases), headers, auth, endpoints, User-Agent, ordem de merge do Stainless e a tradução `betas`→`anthropic-beta` do Bedrock são **idênticos**. Só mudam nomes minificados e as constantes `VERSION`/`BUILD_TIME`/`GIT_SHA`.

**Consequência de planejamento:** este plano não toca `src/headers.ts` em nenhum momento, exceto para leitura. O risco está concentrado em dados (registro de betas, catálogo de modelos) e na resolução de `max_tokens`.

### 1.3 Divergências confirmadas 2.1.195 → 2.1.222

| ID     | Divergência                                                                                                                                                                                                                                                                                                                                                                       | Impacto                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **D1** | Registro de betas 28 → 31 efetivas. **Adicionadas:** `prompt-caching-evict-2026-05-12`, `per-turn-control-2026-07-01`, `server-side-fallback-2026-07-01`, `auto-mode-classifier-2026-07-16`. **Removida:** `summarize-connector-text-2026-03-13` (`narration_summaries`). `prompt-caching-evict` entra _entre_ `PROMPT_CACHING_SCOPE` e `EXTENDED_CACHE_TTL`, deslocando a ordem. | Alto — ordem do registro é load-bearing                                 |
| **D2** | Catálogo 14 → 17 modelos: `claude-sonnet-5`, `claude-opus-5`, `claude-mythos-5`.                                                                                                                                                                                                                                                                                                  | Médio                                                                   |
| **D3** | Capabilities de modelos existentes: `opus-4-6` **perdeu** `fast_mode`; `opus-4-7` **perdeu** `fast_mode`; `fable-5` **ganhou** `refusal_fallback`. Novos nomes de capability: `refusal_fallback`, `opus_5_prompt_bundle`.                                                                                                                                                         | Alto — muda comportamento de betas para modelos já suportados           |
| **D4** | Resolução de `max_output_tokens` reescrita: 195 usa if/else hardcoded; 222 lê do catálogo (`max_output_tokens {default, upper}`) + dois overrides dinâmicos (remote-config `heather_vale`; override por `max_tokens` do request ≥ 4096).                                                                                                                                          | Alto + **ambíguo** (ver §2.1)                                           |
| **D5** | Predicado de contexto 1M: 195 tem `claude-mythos-5` como caso especial hardcoded; 222 dobra no catálogo. Lista de exclusão compartilhada inalterada.                                                                                                                                                                                                                              | Baixo                                                                   |
| **D6** | 222 formaliza o catálogo com schema zod (`capabilities`, `default_effort`, `max_output_tokens`, `context`, `provider_ids`, `pricing`, `fallback_chain`, `advisor_rank`, `image_limits`). Checagens de capability passam por lookup no catálogo em vez de predicados hardcoded.                                                                                                    | **Estrutural** — é a razão de existir a Wave 1                          |
| **D7** | **Billing header ganhou `cc_prev_req`.** O builder passou de 2 para 3 parâmetros. Quando first-party e existe request anterior, anexa `cc_prev_req=<requestId>;`, onde `requestId` é o `request-id` retornado pela chamada anterior da API, recuperado varrendo o histórico de trás para frente até a última mensagem `assistant` com `requestId`.                                | **Alto** — wire-visible; exige modelar um dado de _resposta_ no builder |

### 1.3.1 Fingerprint de billing — verificado, não mudou

Extração direta dos dois binários confirma que o **algoritmo** do fingerprint é byte-for-byte idêntico:

```js
// 2.1.195  UAo(e,t)                     // 2.1.222  Ebs(e,t)
let r=[4,7,20].map(i=>e[i]||"0").join(""),   let n=[4,7,20].map(s=>e[s]||"0").join(""),
    o=`${X7p}${r}${t}`;                          o=`${cky}${n}${t}`;
return FXa.createHash("sha256")              return vNu.createHash("sha256")
  .update(o).digest("hex").slice(0,3)          .update(o).digest("hex").slice(0,3)
// X7p="59cf53e54c78"                      // cky="59cf53e54c78"
```

Salt, índices `[4,7,20]`, fallback `"0"`, ordem de concatenação `salt+indices+VERSION`, SHA-256, hex, truncagem em 3 caracteres — todos idênticos. Só mudaram nomes minificados.

**Porém o valor muda**, porque `VERSION` entra no material do hash. O known-answer vector `7fe` (`docs/source-trace.md`, primeiro texto de usuário `offline cch probe` + CLI `2.1.195`) é específico do 195. O profile 222 precisa do seu **próprio** vetor conhecido, computado e travado em teste.

`cch=00000` permanece literal estático nos dois, com o mesmo gate `(firstParty && ...) || vertex`. A nota de `docs/source-trace.md` sobre o comentário "RE-ENABLED" ser stale continua válida no 222: nenhum mecanismo de xxHash foi ativado, e `_xxh64Raw` não existe como literal em nenhum dos dois binários. A proibição de xxHash em `src/` (`source-hygiene.test.ts`) segue correta e deve ser mantida.

`src/sha256.ts` (SHA-256 hand-rolled) **não é wire-visible** — serve exclusivamente à verificação de integridade de evidência em `parseBuiltClaudeCodeRequest` (`src/build-request.ts:1650`, `if (sha256Hex(body) !== evidence.bodySha256) fail()`). Não é MAC e não deve informar decisão de segurança. Nenhuma mudança necessária.

### 1.4 O defeito arquitetural que impede acompanhar upstream

Hoje existem **duas fontes de verdade** para o mesmo fato:

- `src/profiles/claude-code-2.1.195.ts` — `supportedModels[].capabilities` (dado)
- `src/model-capabilities.ts` — 9 predicados hardcoded por id de modelo (código)
- `src/thinking.ts` — `modelOutputTokenLimits`, tabela if/else por id (código)

Adicionar um modelo hoje exige editar 3 arquivos e manter as três representações coerentes manualmente, sem nenhum teste que force essa coerência. Isso não escala para "acompanhar upstream". Upstream já resolveu isso no 222 movendo tudo para o catálogo.

**Assimetria já existente que precisa ser preservada:** `claude-mythos-5` aparece em `modelOutputTokenLimits` (64000/128000) e no predicado de 1M-context do 195, mas **não** está em `supportedModels`. Ou seja: um id pode ser conhecido pelas tabelas sem estar no catálogo suportado. Qualquer refatoração catalogue-driven precisa preservar esse comportamento, não colapsá-lo.

### 1.5 Correções ao inventário

- `.github/workflows/ci.yml` e `.github/workflows/publish.yml` **existem**. Uma busca inicial por glob não atravessou o diretório-ponto. `test/governance/ci-policy.test.ts` lê os dois com `readFileSync` no carregamento do módulo — a suíte quebraria se estivessem ausentes.
- **Não existe script de regeneração de golden fixtures.** Nenhum script em `scripts/` escreve em `test/fixtures/golden/`. Hoje `manifest.json` e a tabela de hashes em `docs/source-trace.md` são mantidos à mão, em dois lugares, com o teste `source-trace-integrity.test.ts` apenas _verificando_ a coerência. Este plano vai precisar de fixtures novas. Sem tooling, isso é um gerador de erro humano garantido. É a razão de existir a Fase 0.2.

---

## 2. Ambiguidades bloqueantes — decisão humana necessária ANTES da Wave 2

**Status: A1 e A2 RESOLVIDAS pelo owner em 2026-08-05.** A3 foi consequentemente redefinida. A4 e A5 seguem abertas mas não bloqueiam antes da Fase 2.1.

### A1 — Overrides dinâmicos de `max_output_tokens` (D4) — ✅ **RESOLVIDA: opção (b)**

> **Decisão:** aplicar o override derivável do request; documentar o de remote-config como divergência consciente e permanente.

Detalhe da opção escolhida logo abaixo, mantido para rastreabilidade.

O 222 aplica dois overrides sobre o limite do catálogo:

1. Leitura de remote-config (`heather_vale`) → `default = min(remoto, upper)`
2. Se `request.max_tokens >= 4096` → `upper = request.max_tokens`, `default = min(default, upper)`

O pacote é declaradamente **sem I/O e sem leitura de ambiente**. Um fetch de remote-config é arquiteturalmente proibido aqui e quebraria `source-hygiene.test.ts`.

**Opções:**

- **(a)** Modelar ambos como input opcional do chamador (`maxOutputTokensOverride`, `remoteMaxOutputTokens`), documentando que o consumidor é responsável por buscar o remote-config. Preserva a pureza; expande a API pública.
- **(b)** Implementar apenas o override (2) — que é puramente derivável do request — e declarar o override (1) fora de escopo, documentado em `docs/source-trace.md` como divergência conhecida e permanente.
- **(c)** Declarar ambos fora de escopo.

**Recomendação: (b).** ✅ **Escolhida.** O override (2) é determinístico a partir do próprio request e é o que mais provavelmente afeta requests reais. O (1) depende de estado de servidor que o pacote não pode nem deve conhecer, e tratá-lo como input do chamador cria uma API que ninguém sabe preencher corretamente.

### A2 — Coexistência ou substituição de profiles — ✅ **RESOLVIDA: opção (b)**

> **Decisão:** `2.1.222` vira o profile **default**; `2.1.195` permanece disponível como opcional.

**Consequências que este plano passa a carregar:**

1. **É mudança breaking de comportamento.** Quem chama `buildClaudeCodeRequest` sem passar profile explícito passa a emitir requests com `cliVersion: "2.1.222"`, User-Agent diferente, fingerprint de billing diferente, registro de betas diferente e catálogo de modelos diferente. Nada disso é detectável por tipo — o compilador não avisa.
2. **O CHANGELOG precisa declarar isso como breaking em destaque**, não como nota de rodapé.
3. **Golden fixtures do 195 continuam existindo e sendo verificadas** — o profile permanece suportado, apenas deixa de ser o default. Nenhuma fixture 195 pode ser removida.
4. **A prova de não-regressão da Wave 1 continua sendo os digests do 195.** A troca de default acontece na Fase 2.3; até lá, tudo é comparado contra a baseline de 195. Depois da troca, a baseline de 195 continua sendo verificável **via profile explícito**.
5. **O `test:pack` precisa ser ajustado na Fase 2.3.** Ele exercita `buildClaudeCodeRequest` sem profile explícito e compara 3 digests cross-runtime. Ao trocar o default, os 3 digests **vão mudar juntos** — isso é esperado. O que **não** pode mudar é a igualdade entre eles. Ajustar o teste para exercitar **os dois profiles explicitamente**, preservando a comparação cross-runtime para cada um, e registrar a nova baseline.

**Risco principal desta decisão:** o canário de não-regressão do plano (digests do `test:pack`) perde o sinal exatamente no momento em que o default troca. Mitigação obrigatória: fazer o ajuste do `test:pack` para profiles explícitos **antes** da troca de default, dentro da mesma fase, em subtasks separadas e commits separados, de forma que o digest do 195 permaneça observável e comparável à baseline da Fase 0.1 durante e depois da troca.

Análise original mantida abaixo para rastreabilidade.

`src/build-request.ts:319` rejeita qualquer profile que não seja o objeto `2.1.195`. `src/index.ts:62` exporta `CLAUDE_CODE_2_1_195_PROFILE` diretamente.

**Opções:**

- **(a)** Coexistência: ambos os profiles aceitos, `2.1.195` continua sendo o default implícito. Não quebra ninguém. Minor bump (`0.2.0`).
- **(b)** Coexistência com default trocado para `2.1.222`. Mudança de comportamento silenciosa para quem não passa profile explicitamente. Requer major ou pelo menos minor com nota de breaking em CHANGELOG.
- **(c)** Substituição: remove `2.1.195`. Breaking.

~~**Recomendação: (a).**~~ Recomendação não adotada. O owner escolheu (b) com decisão consciente: acompanhar upstream implica que o default seja a versão corrente. A propriedade de "pin verificável" é preservada pelo fato de ambos os profiles continuarem exportados, versionados e cobertos por fixtures — o pin passa a ser explícito em vez de implícito.

### A3 — Versionamento do pacote — **redefinida por A2=(b)**

`release-policy.test.ts` exige que o CHANGELOG tenha um heading de release-candidate batendo com `package.json`.

Como A2=(b) introduz mudança breaking de comportamento (não de tipo), e o pacote está em `0.1.0` (pré-1.0):

- **Proposta: `0.1.0` → `0.2.0`**, com o CHANGELOG declarando `BREAKING CHANGE: default profile is now claude-code-2.1.222` em destaque no topo da entrada.
- Em semver, `0.x` permite breaking em minor. Mas breaking silencioso, sem erro de compilação, num pacote cuja proposta é fidelidade de wire, merece tratamento explícito independentemente do que o semver permite.
- **Alternativa a considerar: ir direto para `1.0.0`.** Se a intenção é que o pacote passe a acompanhar upstream de forma contínua, `0.x` deixa de descrever a realidade e o contrato de estabilidade precisa ser declarado. Decisão do owner.

**Ainda requer confirmação** antes da Fase 4.2. Não bloqueia as Waves 0–3.

### A4 — Proveniência do documento de análise 2.1.222

Os 6 arquivos em `docs/protocol/versions/` são **portados verbatim** de `opencode-anthropic-fix` @ `466d500` (GPL-3.0-or-later), com header de proveniência idêntico. Um `claude-code-2.1.222-analysis.md` **não tem fonte upstream** — seria engenharia reversa first-party deste repositório.

Isso muda o header de proveniência e potencialmente o enquadramento de licença do documento. **Decisão necessária:** qual header usar, e se o documento entra em `versions/` (quebrando a homogeneidade do diretório) ou em um diretório novo tipo `docs/protocol/versions-firstparty/`.

**Recomendação:** manter em `versions/` com um header de proveniência distinto e explícito (`Source: first-party analysis of the published npm artifact; not ported`), e atualizar `versions/README.md` para descrever os dois tipos de documento.

### A5 — Postura sobre engenharia reversa do artefato distribuído

O repositório já pratica isso (é sua razão de existir) e já tem `docs/ATTRIBUTION.md`. Registro aqui para que a decisão seja consciente e não implícita: a Wave 2 depende de continuar extraindo fatos do binário publicado. Se houver restrição jurídica não avaliada, ela precisa ser levantada **agora**, não depois de 4 waves de trabalho.

---

## 3. Arquitetura alvo

### 3.1 Princípio de separação

```
┌─────────────────────────────────────────────────────────────┐
│ CAMADA DE COMPORTAMENTO  (código, versionado só se divergir) │
│  headers.ts        ordem canônica de headers                 │
│  betas.ts          ordem de composição do anthropic-beta     │
│  request-body.ts   ordem de campos do corpo                  │
│  thinking.ts       algoritmo de resolução (não a tabela)     │
│  metadata.ts       composição de user_id                     │
│  → 195 e 222 são IDÊNTICOS aqui. Zero duplicação.            │
├─────────────────────────────────────────────────────────────┤
│ CAMADA DE DADOS  (tabelas por versão)                        │
│  profiles/<v>/beta-registry.ts   registro + ordem            │
│  profiles/<v>/catalogue.ts       modelos, capabilities,      │
│                                  context, max_output_tokens  │
│  → única fonte de verdade. capabilities e limites de token   │
│    derivam DAQUI, não de predicados hardcoded.               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Consequências

- `model-capabilities.ts` deixa de ter 9 predicados hardcoded por id e passa a ser uma função pura `(catalogueEntry) → ClaudeCodeCapabilities`.
- `thinking.ts` mantém o **algoritmo** (`resolveThinking`, `clampMaxTokens`, ordem de chaves do sub-objeto `thinking`) e perde a **tabela** `modelOutputTokenLimits`, que passa a ser lookup no catálogo com fallback preservado.
- Adicionar uma versão futura do CLI passa a ser: um diretório de dados + um documento de análise + fixtures. Não um refactor.

### 3.3 O que NÃO muda

- Contrato público `buildClaudeCodeRequest` / `parseBuiltClaudeCodeRequest`.
- Ordem de headers, ordem de composição de betas, ordem de campos do corpo, ordem de chaves do `thinking`.
- Ausência total de I/O, de leitura de `process.env`, de dependência de runtime.
- Escopo `provider: "anthropic"` exclusivo.

---

## 4. Modelo de paralelismo e propriedade de arquivos

### 4.1 Regras invioláveis

1. **Ownership exclusivo de escrita.** Toda task declara seu conjunto `OWNS` (arquivos que pode escrever). Dois agentes concorrentes **nunca** têm interseção em `OWNS`.
2. **Leitura de arquivo em edição é proibida.** Se o arquivo `X` está em `OWNS` de uma task ativa, nenhuma outra task concorrente pode listá-lo em `READS`. Se precisar, serialize.
3. **Arquivos de alto contágio são sempre serializados**, nunca paralelos:
   - `package.json`
   - `src/index.ts`
   - `src/contracts.ts`
   - `docs/source-trace.md`
   - `test/fixtures/golden/manifest.json`
   - `CHANGELOG.md`
   - `.github/workflows/*.yml`
4. **Barreira de sincronização ao final de cada fase.** Nenhuma task da fase N+1 começa antes do QA review da fase N estar fechado.
5. **Um agente, um commit.** Agentes concorrentes não compartilham index do git. Se o orquestrador rodar tasks paralelas, elas produzem diffs em arquivos disjuntos e o orquestrador commita em sequência.

### 4.2 Template de declaração de task

Toda dispatch de subagente carrega este bloco:

```
OWNS:   <lista exata de caminhos que a task pode escrever>
READS:  <lista exata de caminhos que a task pode ler>
FORBID: <caminhos explicitamente proibidos>
```

### 4.3 Anotação de roteamento de modelo

| Tier            | Uso neste plano                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `[tier:fast]`   | Leitura, grep, inventário, extração de strings do binário, verificação de existência, listagem |
| `[tier:medium]` | Implementação, refactor, escrita de testes, correção de achados de QA, edição de docs          |
| `[tier:heavy]`  | Design arquitetural, QA review sênior, análise de tradeoff, RCA após ≥2 falhas                 |

Regra de dispatch de `[tier:heavy]`: ele **não tem ferramenta de busca**. Sempre precede com coleta de contexto via `[tier:fast]` e injeta os achados literalmente no prompt.

---

## 5. Execução

---

# WAVE 0 — Baseline e rede de segurança

**Objetivo:** tornar impossível quebrar comportamento sem que um teste grite. Nada de mudança funcional.

**Por que primeiro:** as Waves 1 e 2 são, respectivamente, um refactor amplo e um port de dados. Nenhum dos dois é seguro sem (a) baseline reproduzível, (b) tooling de fixture, (c) suítes parametrizáveis por profile.

---

## Fase 0.1 — Baseline verificável

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  package.json, .github/workflows/*, git
```

- [ ] `git status` limpo; branch `feat/upstream-2.1.222-wave-0` criada a partir de `main`
- [ ] `npm ci` completa sem erro
- [ ] `npm run lint` → exit 0
- [ ] `npm run typecheck` → exit 0
- [ ] `npm test` → exit 0, registrar contagem de arquivos e de testes
- [ ] `npm run build` → exit 0
- [ ] `npm run test:coverage` → exit 0, **registrar os 4 thresholds atuais** (line/statement/function/branch) e os valores efetivos
- [ ] `npm run pack:check` → exit 0
- [ ] `npm run test:pack` → exit 0, registrar os 3 digests (node/bun/workerd)
- [ ] `npx vitest run test/drift` → exit 0
- [ ] `npm run drift:check` → registrar se é exit 0 ou exit 2 `SOURCE_UNAVAILABLE`
- [ ] Confirmar que `D:\git\opencode-anthropic-fix` existe ou não; registrar

**Se qualquer gate falhar na baseline: PARE.** É problema crítico — a árvore está vermelha antes de começarmos.

### Tasks

#### T0.1.1 — Snapshot de baseline `[tier:medium]`

```
OWNS:   docs/plans/baseline-2026-08-05.md
READS:  package.json, saídas dos gates acima
```

- **ST0.1.1.1** Registrar em `docs/plans/baseline-2026-08-05.md`: commit SHA, versão do pacote, saída de cada gate, thresholds de cobertura efetivos vs. configurados, os 3 digests do `test:pack`, contagem de arquivos de teste e de casos.
- **ST0.1.1.2** Registrar o hash SHA-256 de cada arquivo em `test/fixtures/golden/` e confrontar com `manifest.json` — provar que estão coerentes hoje.
- Commit: `docs: record pre-migration baseline evidence`

#### T0.1.2 — Mapa de acoplamento a profile `[tier:fast]`

```
OWNS:   docs/plans/profile-coupling-map.md
READS:  src/**, test/**, scripts/**
FORBID: qualquer escrita fora do OWNS
```

- **ST0.1.2.1** Grep exaustivo por `2.1.195`, `2_1_195`, `claude-code-2.1.195`, `CLAUDE_CODE_2_1_195_PROFILE` em `src/`, `test/`, `scripts/`, `docs/`, `package.json`, `.github/`. Listar **todo** file:line.
- **ST0.1.2.2** Classificar cada ocorrência: `DADO` (é o valor da versão, correto), `ACOPLAMENTO` (código que assume que só existe um profile), `DOC` (prosa).
- **ST0.1.2.3** Produzir a lista definitiva de arquivos que a Wave 1 terá de generalizar.
- Commit: `docs: map profile coupling surface`

### Testes novos da fase

Nenhum teste de produto. Esta fase produz **evidência**, não comportamento.

Adicionar apenas:

- `test/governance/baseline-evidence.test.ts` — assegura que `docs/plans/baseline-2026-08-05.md` existe, contém o commit SHA registrado, e que os hashes listados batem com os arquivos reais em `test/fixtures/golden/`. Edge cases: arquivo de fixture adicionado sem entrada de hash; hash presente sem arquivo; SHA de commit malformado.

### Critério de aceitação — Fase 0.1

- [ ] Todos os 10 gates de pre-flight registrados com saída literal
- [ ] `docs/plans/profile-coupling-map.md` lista ≥ todas as ocorrências que um `rg -n "2\.1\.195|2_1_195"` encontra, com classificação
- [ ] `test/governance/baseline-evidence.test.ts` passa e falha corretamente quando um hash é adulterado (verificar por mutação manual + revert)
- [ ] Zero mudança em `src/`

### Definition of Done — Fase 0.1

- [ ] Critérios de aceitação satisfeitos
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` verdes
- [ ] Commits em Conventional Commits com `-s`
- [ ] Nenhum arquivo em `.gitignore` foi commitado

### Senior QA review — Fase 0.1 `[tier:heavy]`

Contexto a injetar (coletado por `[tier:fast]`): conteúdo de `baseline-2026-08-05.md`, `profile-coupling-map.md`, o novo teste, e `git diff` da fase.

Foco da revisão:

1. O mapa de acoplamento está **completo**? Procure ocorrências que um grep ingênuo perderia: strings construídas por concatenação, nomes de arquivo em `package.json` exports, paths em testes de governança.
2. `baseline-evidence.test.ts` realmente falharia numa regressão, ou é um teste tautológico?
3. A baseline capturou os thresholds de cobertura **configurados** ou só os **efetivos**? A diferença importa: se o efetivo está muito acima do configurado, temos folga escondida e a Wave 1 pode reduzir cobertura sem que nada quebre.
4. Há algum gate cuja saída foi registrada como "passou" sem a saída literal?

**Todos os achados do review devem ser corrigidos antes de avançar.** Corrija com `[tier:medium]`, commit `fix:`, e re-rode os gates.

---

## Fase 0.2 — Tooling de golden fixtures

**Justificativa:** não existe caminho de regeneração. A Wave 2 cria fixtures novas para o profile 222 e vai exigir hashes em **dois** lugares (`test/fixtures/golden/manifest.json` e a seção `### Fixture integrity` de `docs/source-trace.md`). Fazer isso à mão em cima de um port de dados é como o erro entra.

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  test/fixtures/golden/*, test/governance/source-trace-integrity.test.ts, docs/source-trace.md, scripts/*
```

- [ ] Fase 0.1 fechada, QA review sem achados abertos
- [ ] Árvore limpa, gates verdes
- [ ] Confirmar o formato exato de `manifest.json` (chaves, formato de hash)
- [ ] Confirmar os limites da seção `### Fixture integrity` em `docs/source-trace.md` (linha inicial, heading de término)
- [ ] Confirmar que `source-trace-integrity.test.ts` valida em ambas as direções (manifest→doc e doc→manifest)

### Tasks

#### T0.2.1 — Script de selagem de fixtures `[tier:medium]`

```
OWNS:   scripts/seal-golden-fixtures.mjs
READS:  test/fixtures/golden/*, docs/source-trace.md, test/governance/source-trace-integrity.test.ts
FORBID: escrever em src/, test/, package.json (o wiring do npm script é T0.2.3)
```

- **ST0.2.1.1** Ler todo `test/fixtures/golden/*.json`, computar SHA-256 de cada um com o **mesmo** algoritmo/encoding que `source-trace-integrity.test.ts` espera. Verificar byte-a-byte contra a implementação existente antes de escrever qualquer coisa.
- **ST0.2.1.2** Modo `--check` (default): compara e sai 1 se divergir, imprimindo `fixture=<nome> expected=<hash> actual=<hash>`. Sem escrita.
- **ST0.2.1.3** Modo `--write`: reescreve `manifest.json` **e** a seção `### Fixture integrity` de `docs/source-trace.md` de forma idempotente, preservando tudo fora da seção intacto byte-a-byte.
- **ST0.2.1.4** Recusar-se a rodar em `--write` se a árvore git estiver suja fora dos dois arquivos alvo. Selagem deve ser um ato deliberado e isolado.
- **ST0.2.1.5** Saída determinística e ordenada (fixtures em ordem lexicográfica), para que o diff seja legível.
- Commit: `chore: add golden fixture sealing script`

#### T0.2.2 — Testes do script de selagem `[tier:medium]`

```
OWNS:   test/tooling/seal-golden-fixtures.test.ts, test/tooling/fixtures/**
READS:  scripts/seal-golden-fixtures.mjs
```

Testar via `spawnSync` contra árvores sintéticas, no mesmo padrão de `test/drift/verify-drift.test.ts`:

- **ST0.2.2.1** `--check` em árvore coerente → exit 0
- **ST0.2.2.2** `--check` com hash divergente → exit 1 + linha exata, sem vazar conteúdo da fixture
- **ST0.2.2.3** `--check` com fixture nova sem entrada no manifest → exit 1
- **ST0.2.2.4** `--check` com entrada no manifest sem arquivo → exit 1
- **ST0.2.2.5** `--check` com hash presente no doc mas ausente do manifest (órfão) → exit 1
- **ST0.2.2.6** `--write` idempotente: rodar duas vezes produz o mesmo arquivo; segunda execução tem diff vazio
- **ST0.2.2.7** `--write` preserva bytes fora da seção `### Fixture integrity` — comparar prefixo e sufixo do documento
- **ST0.2.2.8** `--write` recusa em árvore suja → exit ≠ 0 com mensagem clara
- **ST0.2.2.9** Edge: `manifest.json` vazio; fixture com nome contendo `.`; documento sem a seção `### Fixture integrity`; documento com a seção como última do arquivo (sem heading de término)
- Commit: `test: cover golden fixture sealing script`

#### T0.2.3 — Wiring `[tier:medium]` — **SERIALIZADO** (toca `package.json` e CI)

```
OWNS:   package.json, .github/workflows/ci.yml, test/governance/ci-policy.test.ts
READS:  scripts/seal-golden-fixtures.mjs
```

- **ST0.2.3.1** Adicionar `"fixtures:check": "node scripts/seal-golden-fixtures.mjs --check"` e `"fixtures:seal": "node scripts/seal-golden-fixtures.mjs --write"`
- **ST0.2.3.2** Adicionar `npm run fixtures:check` ao job `quality:` de `ci.yml`
- **ST0.2.3.3** Adicionar `"npm run fixtures:check"` à lista de quality gates asseridos em `ci-policy.test.ts`
- **ST0.2.3.4** Documentar em `CONTRIBUTING.md` que `fixtures:seal` é o único caminho aprovado para atualizar hashes
- Commit: `chore: wire fixture check into quality gates`

### Testes novos da fase

Cobertos em T0.2.2 (9 casos, incluindo 4 de edge case explícitos). Adicionalmente:

- Assegurar que `source-trace-integrity.test.ts` continua passando sem modificação — o novo script não substitui o teste de governança, complementa. Se o script tornasse o teste redundante, seria sinal de que o script é frouxo demais.

### Critério de aceitação — Fase 0.2

- [ ] `npm run fixtures:check` sai 0 no estado atual do repo, sem ter modificado nada
- [ ] `npm run fixtures:seal` em árvore limpa produz diff **vazio** (prova de que o estado atual já é o estado selado)
- [ ] Todos os 9 casos de T0.2.2 passam
- [ ] `test/governance/ci-policy.test.ts` passa com o novo gate incluído
- [ ] `source-trace-integrity.test.ts` passa sem modificação
- [ ] Injetar deliberadamente um hash errado em `manifest.json` → `fixtures:check` **e** `source-trace-integrity.test.ts` ambos falham. Reverter.

### Definition of Done — Fase 0.2

- [ ] Critérios de aceitação satisfeitos
- [ ] Gates completos verdes, incluindo `test:coverage`, `pack:check`, `test:pack`
- [ ] `scripts/seal-golden-fixtures.mjs` não escreve nada em modo `--check` (verificado por mtime)
- [ ] Commits atômicos, conventional, signed-off

### Senior QA review — Fase 0.2 `[tier:heavy]`

Contexto a injetar: `scripts/seal-golden-fixtures.mjs` completo, `test/tooling/seal-golden-fixtures.test.ts` completo, o diff de `package.json`/`ci.yml`/`ci-policy.test.ts`, e o corpo de `source-trace-integrity.test.ts`.

Foco:

1. O algoritmo de hash do script é **provadamente** o mesmo do teste de governança? Se divergirem em encoding, newline ou normalização, criamos uma ferramenta que sela o estado errado com confiança total. Este é o maior risco da fase.
2. `--write` é realmente idempotente sob CRLF? O repo é Windows. Um script que normaliza newlines vai fazer o doc oscilar entre estados.
3. A recusa em árvore suja é contornável? Um agente com pressa vai contornar.
4. O script pode ser usado para **mascarar** uma regressão de wire? Se sim, o gate de CI precisa ser `--check`, nunca `--write`. Confirmar que nenhum caminho de CI invoca `--write`.
5. Falta algum edge case: fixture com BOM, fixture não-JSON, symlink, arquivo de 0 bytes.

Corrigir todos os achados com `[tier:medium]`, commit `fix:`, re-rodar gates.

---

## Fase 0.3 — Parametrização das suítes por profile

**Justificativa:** hoje as suítes assumem um profile. Depois da Wave 2 haverá dois. Sem parametrização, o profile 222 nasce com uma fração da cobertura do 195 — que é exatamente o cenário em que um bug de port passa.

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  test/**, docs/plans/profile-coupling-map.md
```

- [ ] Fase 0.2 fechada, QA sem achados abertos
- [ ] Gates verdes
- [ ] Enumerar quais dos 86 arquivos de teste referenciam o profile direta ou indiretamente (usar `profile-coupling-map.md`)
- [ ] Classificar cada suíte: `PROFILE-AGNOSTIC` (testa algoritmo puro), `PROFILE-PARAMETRIZÁVEL` (mesma asserção vale para qualquer profile), `PROFILE-ESPECÍFICA` (asserção é sobre os dados do 195 e deve permanecer amarrada a ele)

### Tasks

#### T0.3.1 — Harness de profile `[tier:medium]`

```
OWNS:   test/support/profile-matrix.ts
READS:  src/profiles/**, test/support/**
```

- **ST0.3.1.1** Criar um registro de profiles sob teste, hoje contendo só o 195, exportando os metadados que as suítes precisam (id, cliVersion, endpoint, contagem esperada de betas, contagem esperada de modelos).
- **ST0.3.1.2** Expor um helper `describeEachProfile(fn)` que roda um bloco por profile registrado.
- **ST0.3.1.3** Garantir que adicionar um profile ao registro **automaticamente** amplia todas as suítes parametrizadas — sem edição das suítes.
- Commit: `test: add profile matrix harness`

#### T0.3.2 — Migrar suítes parametrizáveis `[tier:medium]` — paralelizável em 3 lotes disjuntos

Três agentes concorrentes, `OWNS` estritamente disjuntos:

- **Lote A** `OWNS: test/validation/headers*.test.ts, test/validation/betas*.test.ts` (nomes exatos de `profile-coupling-map.md`)
- **Lote B** `OWNS: test/validation/request-body*.test.ts, test/validation/thinking*.test.ts, test/validation/metadata*.test.ts`
- **Lote C** `OWNS: test/validation/model-*.test.ts, test/validation/mutants*.test.ts`

Todos `READS: test/support/profile-matrix.ts` (que já estará commitado e fechado — não é editado por ninguém nesta fase).
`FORBID` para todos: `test/governance/**`, `test/conformance/**`, `src/**`, `package.json`

- **ST0.3.2.x** Por lote: converter as asserções parametrizáveis para `describeEachProfile`, preservando literalmente a asserção. **Zero mudança de semântica.** A contagem de casos deve aumentar apenas por multiplicação de profiles (hoje ×1, portanto igual).
- Commit por lote: `test: parameterize <área> suites by profile`

#### T0.3.3 — Guard de cobertura por profile `[tier:medium]` — **SERIALIZADO**

```
OWNS:   test/governance/profile-coverage.test.ts
READS:  test/support/profile-matrix.ts, test/**
```

- **ST0.3.3.1** Teste que enumera os profiles registrados e assere que cada um é exercido por um conjunto mínimo de suítes nomeadas (headers, betas, request-body, thinking, metadata, model identity, golden fixture).
- **ST0.3.3.2** Falha explícita e legível se um profile for registrado sem cobertura — esta é a rede que impede o profile 222 de nascer meio testado.
- Commit: `test: enforce per-profile coverage floor`

### Testes novos da fase

- `test/governance/profile-coverage.test.ts` (T0.3.3)
- Edge cases obrigatórios: registro vazio; profile registrado sem nenhuma suíte; suíte declarada que não existe no disco; profile duplicado no registro.

### Critério de aceitação — Fase 0.3

- [ ] Contagem total de casos de teste ≥ baseline registrada em 0.1 (não pode cair)
- [ ] `profile-coverage.test.ts` falha corretamente quando um profile fake é adicionado ao registro sem suítes (verificar por mutação + revert)
- [ ] Nenhuma asserção foi enfraquecida na migração — verificar por diff que só a estrutura `describe` mudou
- [ ] `test/conformance/` e `test/governance/` intocados exceto o novo arquivo
- [ ] Cobertura ≥ baseline em todas as 4 métricas

### Definition of Done — Fase 0.3

- [ ] Critérios de aceitação satisfeitos
- [ ] Gates completos verdes
- [ ] Adicionar um profile ao harness demonstravelmente amplia as suítes (provar com um profile dummy temporário; reverter)
- [ ] Nenhum conflito de merge entre os 3 lotes paralelos

### Senior QA review — Fase 0.3 `[tier:heavy]`

Contexto a injetar: `profile-matrix.ts`, `profile-coverage.test.ts`, o diff completo dos 3 lotes, e a contagem de casos antes/depois.

Foco:

1. Alguma asserção foi **enfraquecida** durante a migração? Compare asserção por asserção, não por contagem. Contagem igual com asserção mais fraca é o modo de falha clássico deste tipo de refactor.
2. `describeEachProfile` pode silenciosamente rodar zero vezes se o registro estiver vazio? Se sim, uma suíte inteira desaparece sem ninguém notar.
3. A classificação `PROFILE-ESPECÍFICA` está correta, ou parametrizamos algo que só é verdade para o 195 e vai falhar de forma confusa no 222?
4. O guard de cobertura tem teeth reais ou só verifica nomes de arquivo?

Corrigir todos os achados. Commit `fix:`. Re-rodar gates.

### Fechamento da Wave 0

- [ ] QA review das 3 fases sem achados abertos
- [ ] Merge de `feat/upstream-2.1.222-wave-0` em `main`
- [ ] Tag opcional `baseline-pre-222`

---

# WAVE 1 — Preparação arquitetural (behavior-preserving)

**Objetivo:** eliminar as fontes de verdade duplicadas e desacoplar o código de um profile único. **Zero mudança de comportamento de wire.** As golden fixtures são a prova: se elas mudarem, algo quebrou.

**Regra de ouro da Wave 1:** ao final de cada fase, `npm run fixtures:check` sai 0 e `test/conformance/differential.test.ts` passa sem que nenhuma fixture tenha sido tocada.

---

## Fase 1.1 — Capabilities catalogue-driven

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/model-capabilities.ts, src/profiles/claude-code-2.1.195.ts, src/contracts.ts, test/validation/model-*.test.ts
```

- [ ] Wave 0 fechada e mergeada em `main`; branch `feat/upstream-2.1.222-wave-1` criada
- [ ] Gates verdes
- [ ] **Mapear os 9 predicados de `model-capabilities.ts` contra `supportedModels[].capabilities` do profile 195 e produzir uma tabela de equivalência id×capability, provando que as duas representações concordam hoje.** Se discordarem em qualquer célula, isso é um **achado crítico** — significa que já existe uma incoerência latente. Registrar e escalar antes de refatorar.
- [ ] Registrar o comportamento atual para ids **fora** do catálogo (ex.: `claude-mythos-5`, ids desconhecidos) — os predicados são baseados em exclusão, então um id desconhecido recebe capabilities por default. Este comportamento precisa ser preservado.

### Tasks

#### T1.1.1 — Tabela de equivalência `[tier:medium]`

```
OWNS:   test/validation/capability-equivalence.test.ts
READS:  src/model-capabilities.ts, src/profiles/claude-code-2.1.195.ts
```

- **ST1.1.1.1** Teste que, para **cada** id em `supportedModels`, assere que `deriveCapabilities(id)` concorda com `capabilities[]` declarado no catálogo, célula a célula, para as 9 capabilities.
- **ST1.1.1.2** Casos para ids fora do catálogo: `claude-mythos-5`, `claude-opus-5` (ainda inexistente no 195), string vazia, id malformado, id com sufixo `[1m]`.
- **ST1.1.1.3** Este teste deve passar **antes** do refactor. Ele é a especificação executável do refactor.
- Commit: `test: pin capability derivation equivalence`

**Se T1.1.1 não passar de cara: PARE.** É incoerência pré-existente entre dado e código — problema crítico, escalar.

#### T1.1.2 — Refactor para lookup no catálogo `[tier:medium]`

```
OWNS:   src/model-capabilities.ts
READS:  src/profiles/claude-code-2.1.195.ts, src/contracts.ts, test/validation/capability-equivalence.test.ts
FORBID: src/profiles/**, src/thinking.ts, src/betas.ts
```

- **ST1.1.2.1** Introduzir `deriveCapabilitiesFromCatalogue(entry)` — função pura de uma entrada de catálogo para `ClaudeCodeCapabilities`.
- **ST1.1.2.2** Manter o caminho de fallback por predicado **exclusivamente** para ids ausentes do catálogo, preservando o comportamento registrado no pre-flight.
- **ST1.1.2.3** Preservar `supportsStructuredOutputs` e `supportsMidConversationSystem` (gates que `betas.ts` consome diretamente, fora de `ClaudeCodeCapabilities`) — decidir se derivam do catálogo ou permanecem predicados. Documentar a escolha.
- **ST1.1.2.4** Não alterar a assinatura pública de `deriveCapabilities`.
- Commit: `refactor: derive model capabilities from profile catalogue`

#### T1.1.3 — Guard contra regressão de fonte dupla `[tier:medium]`

```
OWNS:   test/governance/single-source-of-truth.test.ts
READS:  src/**
```

- **ST1.1.3.1** Teste de governança que assere que `src/model-capabilities.ts` não contém mais uma lista hardcoded de ids de modelo além do bloco de fallback explicitamente demarcado e justificado (mesmo padrão de allowlist justificada que `provider-scope.test.ts` usa).
- **ST1.1.3.2** Falha se alguém reintroduzir uma tabela paralela.
- Commit: `test: guard against duplicated model capability tables`

### Testes novos da fase

- `capability-equivalence.test.ts` — 9 capabilities × 14 modelos + 5 edge cases = 131 asserções mínimas
- `single-source-of-truth.test.ts` — incluindo edge: comentário contendo id de modelo não deve disparar falso positivo (reusar o `stripComments` de `provider-scope.test.ts`)

### Critério de aceitação — Fase 1.1

- [ ] `capability-equivalence.test.ts` passa antes **e** depois do refactor, sem modificação
- [ ] `npm run fixtures:check` → exit 0, **nenhuma fixture modificada**
- [ ] `test/conformance/differential.test.ts` passa
- [ ] `single-source-of-truth.test.ts` falha se um array de ids for reintroduzido (verificar por mutação + revert)
- [ ] Comportamento para ids desconhecidos idêntico ao registrado no pre-flight
- [ ] Cobertura ≥ baseline

### Definition of Done — Fase 1.1

- [ ] Critérios satisfeitos
- [ ] Gates completos verdes incluindo `test:pack` (os 3 digests devem ser **idênticos** aos da baseline — mudança de digest aqui é regressão de wire)
- [ ] `provider-scope.test.ts` continua passando
- [ ] `source-hygiene.test.ts` continua passando

### Senior QA review — Fase 1.1 `[tier:heavy]`

Contexto: `src/model-capabilities.ts` antes e depois, `capability-equivalence.test.ts`, `single-source-of-truth.test.ts`, os 3 digests de `test:pack` antes e depois.

Foco:

1. Os 3 digests de `test:pack` mudaram? Se sim, **é regressão de wire** — o refactor não foi behavior-preserving. Investigar antes de qualquer outra coisa.
2. O fallback para ids desconhecidos preserva exatamente a semântica de exclusão dos predicados originais, ou introduziu um default diferente?
3. `supportsStructuredOutputs` / `supportsMidConversationSystem` ficaram órfãos — consumidos por `betas.ts` mas derivados de outro lugar? Isso reintroduz a fonte dupla por outra porta.
4. O teste de equivalência é forte o suficiente para pegar uma inversão de sinal em uma capability pouco usada (`rejectsDisabledThinking`)?

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 1.2 — Limites de token catalogue-driven

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/thinking.ts, src/profiles/claude-code-2.1.195.ts, test/validation/thinking*.test.ts
```

- [ ] Fase 1.1 fechada, QA sem achados
- [ ] Gates verdes; digests de `test:pack` iguais à baseline
- [ ] Registrar a tabela `modelOutputTokenLimits` completa (14 branches + fallback) como dado
- [ ] **Confirmar a assimetria `claude-mythos-5`**: presente na tabela de limites, ausente de `supportedModels`. Registrar o valor exato (64000/128000) e o comportamento atual.
- [ ] Confirmar que o profile 195 **não** carrega `max_output_tokens` em `supportedModels` hoje — se não carrega, a Fase 1.2 precisa **adicionar** esse campo ao catálogo, o que toca `contracts.ts` (arquivo de alto contágio → serializado)

### Tasks

#### T1.2.1 — Especificação executável dos limites `[tier:medium]`

```
OWNS:   test/validation/token-limits-equivalence.test.ts
READS:  src/thinking.ts
```

- **ST1.2.1.1** Teste tabular cobrindo os 14 branches + fallback, asserindo `{default, upperLimit}` exato.
- **ST1.2.1.2** Edge cases: `claude-mythos-5` (fora do catálogo, dentro da tabela); id desconhecido → fallback 32000/128000; id com sufixo `[1m]`; string vazia; id que é prefixo de outro (`claude-opus-4-1` vs `claude-opus-4-1x`).
- **ST1.2.1.3** Casos de `clampMaxTokens` e de `budget_tokens`: `min(maxTokens-1, requested)`; default `upperLimit-1`; `requested` maior que `upper`; `maxTokens` = 1 (borda: `budget_tokens` = 0); `maxTokens` = 0.
- **ST1.2.1.4** Ordem de chaves do sub-objeto `thinking` — `{type, display}` para adaptive, `{budget_tokens, type, display}` para enabled — asserida sobre `Object.keys()`, não sobre igualdade profunda.
- Commit: `test: pin token limit resolution table`

#### T1.2.2 — Extensão do contrato de catálogo `[tier:medium]` — **SERIALIZADO** (`contracts.ts`)

```
OWNS:   src/contracts.ts
READS:  src/thinking.ts, src/profiles/claude-code-2.1.195.ts
FORBID: src/profiles/**, src/thinking.ts, src/index.ts
```

- **ST1.2.2.1** Adicionar `maxOutputTokens?: { default: number; upper: number }` a `ClaudeCodeCatalogueEntry`, **opcional**, para não quebrar nada.
- **ST1.2.2.2** Nenhuma mudança em tipos exportados que altere a superfície pública de forma breaking — verificar com `test/types/public-api.test-d.ts`.
- Commit: `refactor: allow catalogue entries to carry output token limits`

#### T1.2.3 — Popular o catálogo 195 `[tier:medium]`

```
OWNS:   src/profiles/claude-code-2.1.195.ts
READS:  src/thinking.ts, src/contracts.ts
FORBID: src/thinking.ts, src/contracts.ts
```

- **ST1.2.3.1** Preencher `maxOutputTokens` para os 14 modelos com **exatamente** os valores da tabela atual. Zero reinterpretação.
- Commit: `refactor: declare output token limits in 2.1.195 catalogue`

#### T1.2.4 — Redirecionar a resolução `[tier:medium]`

```
OWNS:   src/thinking.ts
READS:  src/profiles/claude-code-2.1.195.ts, src/contracts.ts, test/validation/token-limits-equivalence.test.ts
FORBID: src/profiles/**, src/contracts.ts
```

- **ST1.2.4.1** `modelOutputTokenLimits` passa a consultar o catálogo primeiro.
- **ST1.2.4.2** **Preservar a tabela de fallback** para ids fora do catálogo — `claude-mythos-5` e os `claude-3-*` legados dependem dela. Demarcar e justificar explicitamente.
- **ST1.2.4.3** Algoritmo (`resolveThinking`, `clampMaxTokens`, ordem de chaves) intocado.
- Commit: `refactor: resolve output token limits from catalogue`

### Testes novos da fase

- `token-limits-equivalence.test.ts` — 15 branches + 9 edge cases mínimos
- Ampliar `capability-equivalence.test.ts` para incluir `maxOutputTokens` na verificação de coerência dado×código

### Critério de aceitação — Fase 1.2

- [ ] `token-limits-equivalence.test.ts` passa antes e depois, sem modificação
- [ ] Digests de `test:pack` **idênticos** à baseline
- [ ] `npm run fixtures:check` exit 0, fixtures intocadas
- [ ] `claude-mythos-5` continua resolvendo 64000/128000 apesar de fora de `supportedModels`
- [ ] `public-api.test-d.ts` passa — nenhuma quebra de tipo público
- [ ] Cobertura ≥ baseline

### Definition of Done — Fase 1.2

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `contracts.ts` tocado por exatamente um commit, isolado
- [ ] Nenhum teste de governança quebrado

### Senior QA review — Fase 1.2 `[tier:heavy]`

Contexto: `thinking.ts` antes/depois, `contracts.ts` diff, `claude-code-2.1.195.ts` diff, `token-limits-equivalence.test.ts`, digests de `test:pack`.

Foco:

1. Digests mudaram? Regressão de wire.
2. O fallback preserva `claude-mythos-5`, ou o refactor "limpou" um caso que parecia morto e não era?
3. Precedência catálogo-vs-fallback: um id **presente** no catálogo mas **sem** `maxOutputTokens` cai no fallback ou em `undefined`? Este é o caminho de erro mais provável e precisa de teste.
4. `budget_tokens` com `maxTokens = 1` → 0. Isso é o que o upstream faz, ou introduzimos um valor inválido? Confirmar contra o binário 195.
5. Tornar `maxOutputTokens` opcional cria um catálogo parcialmente populado — há guard que impeça um profile futuro de esquecer o campo?

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 1.3 — Generalizar governança e drift para múltiplos profiles

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  test/governance/**, scripts/verify-drift.mjs, test/drift/**, docs/plans/profile-coupling-map.md
```

- [ ] Fase 1.2 fechada, QA sem achados; gates verdes
- [ ] Confirmar os pontos exatos de acoplamento a `src/profiles/claude-code-2.1.195.ts` por path literal:
  - `provider-scope.test.ts` — `it("pins the profile to the anthropic first-party literal")` lê o path do 195 diretamente
  - `scripts/verify-drift.mjs` — lê o path do 195 diretamente
  - `package-policy.test.ts`, `public-path-coverage.test.ts`, `public-files.test.ts` — verificar
- [ ] Enumerar as fixtures de `test/drift/fixtures/` e confirmar que o script sob teste continua com contrato de saída estável

### Tasks

#### T1.3.1 — Generalizar `provider-scope.test.ts` `[tier:medium]`

```
OWNS:   test/governance/provider-scope.test.ts
READS:  src/profiles/**, src/**
```

- **ST1.3.1.1** Trocar o path literal por descoberta de **todos** os arquivos em `src/profiles/*.ts`, aplicando as mesmas asserções a cada um.
- **ST1.3.1.2** Adicionar asserção de que existe ≥1 profile — senão o teste passa vacuamente com o diretório vazio.
- **ST1.3.1.3** Preservar intactas as 15 asserções existentes, incluindo o allowlist justificado de `BEDROCK_UNSUPPORTED_BETAS` e a regra de "declarado, nunca consumido".
- Commit: `test: generalize provider scope enforcement across profiles`

#### T1.3.2 — Generalizar `verify-drift.mjs` `[tier:medium]`

```
OWNS:   scripts/verify-drift.mjs
READS:  src/profiles/**, test/drift/**
FORBID: test/drift/verify-drift.test.ts (é de T1.3.3)
```

- **ST1.3.2.1** Aceitar `--profile <id>` com default `claude-code-2.1.195-sdk-0.94.0`, preservando o comportamento atual quando o flag é omitido.
- **ST1.3.2.2** Preservar exatamente os contratos de saída: `profile=<id> drift=none`, `category=<cat> fields=<field>`, `SOURCE_UNAVAILABLE`, e os exit codes 0/1/2.
- **ST1.3.2.3** Não vazar valores proibidos na saída de erro (regra existente).
- Commit: `chore: support profile selection in drift verification`

#### T1.3.3 — Ampliar `test/drift/` `[tier:medium]` — **SERIALIZADO após T1.3.2**

```
OWNS:   test/drift/verify-drift.test.ts, test/drift/fixtures/**
READS:  scripts/verify-drift.mjs
```

- **ST1.3.3.1** Preservar os 8 casos existentes sem alteração (comportamento default).
- **ST1.3.3.2** Adicionar: `--profile` com id desconhecido → erro claro; `--profile` explícito com o id do 195 → idêntico ao default; `--profile` com id válido mas sem fixture de origem correspondente.
- Commit: `test: cover profile-scoped drift verification`

#### T1.3.4 — Aceitação de múltiplos profiles em `build-request.ts` `[tier:medium]` — **SERIALIZADO**

```
OWNS:   src/build-request.ts
READS:  src/profiles/**, src/contracts.ts
FORBID: src/index.ts, package.json
```

- **ST1.3.4.1** Substituir a rejeição hardcoded de profile único (`build-request.ts:319`) por verificação contra um registro de profiles aceitos.
- **ST1.3.4.2** O registro contém **apenas o 195** ao final desta fase. A generalização é estrutural; a adição do 222 é Wave 2.
- **ST1.3.4.3** Preservar `ClaudeCodeWireError` com o **mesmo código de erro e a mesma mensagem** para profile não reconhecido — consumidores podem depender disso.
- **ST1.3.4.4** Objeto de profile forjado com o id correto mas conteúdo diferente deve continuar sendo rejeitado. Verificar que a checagem é de identidade/integridade, não só de id.
- Commit: `refactor: accept profiles via registry instead of single literal`

### Testes novos da fase

- Ampliação de `provider-scope.test.ts` (descoberta + guard de vacuidade)
- 3 casos novos em `test/drift/verify-drift.test.ts`
- Novo `test/validation/profile-acceptance.test.ts`: profile válido aceito; profile desconhecido rejeitado com código e mensagem exatos; profile forjado com id correto rejeitado; profile `null`/`undefined`/objeto vazio; profile com campos extras; profile congelado vs não-congelado

### Critério de aceitação — Fase 1.3

- [ ] `provider-scope.test.ts` cobre todos os arquivos de `src/profiles/` e falha com diretório vazio
- [ ] `verify-drift.mjs` sem flag produz saída **byte-idêntica** à anterior
- [ ] Os 8 casos originais de drift passam sem modificação
- [ ] Rejeição de profile forjado preserva código e mensagem de erro
- [ ] Digests de `test:pack` idênticos à baseline
- [ ] Fixtures intocadas

### Definition of Done — Fase 1.3

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `ci-policy.test.ts` passa
- [ ] Nenhuma mudança na superfície pública além do que `public-api.test-d.ts` aprova

### Senior QA review — Fase 1.3 `[tier:heavy]`

Contexto: diffs de `provider-scope.test.ts`, `verify-drift.mjs`, `verify-drift.test.ts`, `build-request.ts`; o novo `profile-acceptance.test.ts`; saída literal de `verify-drift` antes e depois.

Foco:

1. `provider-scope.test.ts` continua com os mesmos **teeth**? Generalizar por descoberta é o jeito clássico de acidentalmente afrouxar um teste de governança.
2. O registro de profiles pode ser burlado por um objeto que satisfaz o shape mas não é o profile canônico? Se a checagem virou estrutural em vez de identidade, o pin deixou de ser um pin.
3. Contrato de saída de `verify-drift.mjs` preservado byte-a-byte — inclusive newline final?
4. Adicionar `--profile` abre caminho para vazamento de valor proibido na mensagem de erro?
5. Vacuidade: algum dos testes generalizados passa com entrada vazia?

Corrigir todos. Commit `fix:`. Re-rodar.

### Fechamento da Wave 1

- [ ] QA das 3 fases sem achados abertos
- [ ] **Prova de behavior-preservation:** digests de `test:pack` idênticos à baseline da Fase 0.1; zero fixture modificada; `differential.test.ts` verde
- [ ] Merge em `main`
- [ ] **Checkpoint de decisão:** confirmar que A1–A5 (§2) estão respondidas. **A Wave 2 não começa sem A1 e A2.**

---

# WAVE 2 — Port de dados do 2.1.222

**Objetivo:** adicionar o profile `2.1.222` como **dado**, exercitando a arquitetura construída na Wave 1. Se esta wave exigir mudança estrutural em `src/` fora de `src/profiles/`, a Wave 1 falhou e isso é um achado a escalar.

---

## Fase 2.1 — Documento de evidência

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  docs/protocol/versions/**, docs/ATTRIBUTION.md
```

- [ ] Wave 1 mergeada; branch `feat/upstream-2.1.222-wave-2` criada; gates verdes
- [ ] **A1 e A2 respondidas** — se não, PARE e escale
- [ ] **A4 respondida** (proveniência do documento) — se não, PARE e escale
- [ ] Confirmar disponibilidade dos dumps de string de `2.1.222` e `2.1.195`; se ausentes, regenerar a partir do artefato npm antes de prosseguir
- [ ] Ler o header de proveniência de um documento existente de `versions/` para replicar o template

### Tasks

#### T2.1.1 — Extração e verificação de evidência `[tier:fast]`

```
OWNS:   (nenhum — só produz relatório para o orquestrador)
READS:  dumps de string 222 e 195
```

- **ST2.1.1.1** Reconfirmar D1: as 32 posições do array congelado, as 4 adições, a 1 remoção, a posição de inserção de `prompt-caching-evict`.
- **ST2.1.1.2** Reconfirmar D2: os 3 modelos novos e sua posição no catálogo.
- **ST2.1.1.3** Reconfirmar D3: capabilities exatas por modelo para os 17, com atenção aos deltas de `opus-4-6`, `opus-4-7`, `fable-5`.
- **ST2.1.1.4** Extrair `max_output_tokens {default, upper}` do catálogo 222 para os 17 modelos.
- **ST2.1.1.5** Extrair `default_effort` por modelo e o bloco `context` por modelo.
- **ST2.1.1.6** Confirmar que `anthropic-version`, endpoints, UA, `x-app`, `x-stainless-*` e ordem de headers permanecem idênticos (re-verificação, não confiar no registro anterior).
- Usar extração limitada (`rg -o -N '.{N}ANCHOR.{M}'`) — os dumps são quase linha-única.

#### T2.1.2 — Documento de análise `[tier:medium]`

```
OWNS:   docs/protocol/versions/claude-code-2.1.222-analysis.md, docs/protocol/versions/README.md
READS:  docs/protocol/versions/*, saída de T2.1.1
```

- **ST2.1.2.1** Escrever o documento seguindo o template estrutural dos existentes, com o header de proveniência decidido em A4 (análise first-party, não portada).
- **ST2.1.2.2** Documentar D1–D6 com evidência concreta.
- **ST2.1.2.3** Documentar explicitamente o que está **fora de escopo** (conforme A1) e por quê.
- **ST2.1.2.4** Atualizar `versions/README.md` para descrever os dois tipos de proveniência de documento.
- Commit: `docs: add 2.1.222 wire analysis`

#### T2.1.3 — Atualizar `docs/source-trace.md` `[tier:medium]` — **SERIALIZADO** (alto contágio)

```
OWNS:   docs/source-trace.md
READS:  docs/protocol/versions/claude-code-2.1.222-analysis.md
FORBID: test/fixtures/golden/**
```

- **ST2.1.3.1** Adicionar a linha do profile 222 na tabela de profiles.
- **ST2.1.3.2** Registrar as divergências conscientes e permanentes (D4 overrides fora de escopo, conforme A1).
- **ST2.1.3.3** **Não tocar** a seção `### Fixture integrity` — ela é propriedade exclusiva de `fixtures:seal`.
- Commit: `docs: record 2.1.222 profile in source trace`

### Testes novos da fase

- Ampliar `source-trace-integrity.test.ts` (ou adicionar teste irmão) para asserir que todo profile registrado aparece na tabela de profiles de `docs/source-trace.md`. Edge: profile registrado sem linha na tabela; linha na tabela sem profile registrado.
- Teste de governança: todo arquivo em `docs/protocol/versions/` tem header de proveniência válido de um dos dois tipos aprovados.

### Critério de aceitação — Fase 2.1

- [ ] Toda afirmação de D1–D6 no documento tem evidência rastreável
- [ ] `source-trace-integrity.test.ts` passa (seção de fixtures intocada)
- [ ] Novo teste de proveniência passa e falha com header inválido (mutação + revert)
- [ ] Zero mudança em `src/`

### Definition of Done — Fase 2.1

- [ ] Critérios satisfeitos, gates verdes
- [ ] `public-files.test.ts` passa (headers SPDX/atribuição)
- [ ] Nenhum segredo, path local ou nome de ferramenta interna vazado no documento público

### Senior QA review — Fase 2.1 `[tier:heavy]`

Contexto: documento completo, diff de `source-trace.md`, diff de `versions/README.md`, saída de T2.1.1.

Foco:

1. Alguma afirmação do documento é **não verificada** — herdada do registro anterior sem re-extração? Documento de evidência com afirmação não verificada é pior que ausência de documento.
2. A remoção de `narration_summaries` está documentada com a consequência para o consumidor, ou só como fato?
3. O header de proveniência é juridicamente coerente com `docs/ATTRIBUTION.md` e com GPL-3.0-or-later?
4. Vazou algum path local (`D:\...`), nome de ferramenta interna ou artefato de processo no documento público?

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 2.2 — Registro de betas 2.1.222

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/beta-registry.ts, src/betas.ts, docs/protocol/versions/claude-code-2.1.222-analysis.md
```

- [ ] Fase 2.1 fechada, QA sem achados; gates verdes
- [ ] Confirmar se `beta-registry.ts` hoje é global (compartilhado) ou por profile — determina se a Fase 2.2 cria um arquivo novo ou versiona o existente
- [ ] Confirmar quais dos 3 conjuntos derivados (`THIRD_PARTY_ALLOWED_BETAS`, `BEDROCK_UNSUPPORTED_BETAS`, `COUNT_TOKENS_BETAS`) mudam no 222 — **se não foi extraído em T2.1.1, extrair agora antes de codificar**
- [ ] Confirmar a ordem completa das 31 entradas do 222, não só o delta

### Tasks

#### T2.2.1 — Registro versionado `[tier:medium]`

```
OWNS:   src/profiles/beta-registry-2.1.222.ts   (nome final conforme convenção decidida)
READS:  src/beta-registry.ts, docs/protocol/versions/claude-code-2.1.222-analysis.md
FORBID: src/beta-registry.ts, src/betas.ts
```

- **ST2.2.1.1** Declarar as 31 entradas na ordem exata do 222.
- **ST2.2.1.2** Declarar os 3 conjuntos derivados com o conteúdo do 222.
- **ST2.2.1.3** `narration_summaries` **ausente** — e um comentário explicando que a ausência é deliberada, para que ninguém "conserte" isso depois.
- Commit: `feat: add 2.1.222 beta registry`

#### T2.2.2 — Composição de betas ciente do registro `[tier:medium]` — **SERIALIZADO**

```
OWNS:   src/betas.ts
READS:  src/beta-registry.ts, src/profiles/beta-registry-2.1.222.ts
FORBID: src/profiles/**, src/headers.ts
```

- **ST2.2.2.1** `composeBetasWithAudit` passa a consultar o registro **do profile**, em vez do global.
- **ST2.2.2.2** O passo 7 (`NARRATION_SUMMARIES`) precisa se tornar condicional à presença da entrada no registro do profile. Quando ausente, o passo é pulado — **sem lançar erro**, e sem alterar a ordem dos demais passos.
- **ST2.2.2.3** **A ordem dos 17 passos de composição é imutável.** Só a disponibilidade de cada beta varia por registro.
- **ST2.2.2.4** Comportamento para 195 **byte-idêntico** ao atual.
- Commit: `refactor: resolve beta composition against profile registry`

### Testes novos da fase

- `test/validation/betas-2.1.222.test.ts`:
  - 31 entradas na ordem exata; `prompt-caching-evict` na posição correta entre `PROMPT_CACHING_SCOPE` e `EXTENDED_CACHE_TTL`
  - `summarize-connector-text-2026-03-13` **ausente** do registro
  - `narrationSummariesEnabled: true` no profile 222 → header **não** emitido, **sem erro**
  - Os 3 conjuntos derivados com conteúdo esperado
  - Ordem de composição preservada quando um beta do meio da sequência está ausente
  - `additionalBetas` e `suppressBetas` continuam funcionando; `suppressBetas` continua aplicado por último
  - Edge: suprimir um beta que não existe no registro; adicionar um beta que já está presente; `additionalBetas` com string vazia; registro com zero entradas
- Ampliar a suíte parametrizada de betas (Fase 0.3) para cobrir o 222 automaticamente

### Critério de aceitação — Fase 2.2

- [ ] Header `anthropic-beta` do profile 195 **byte-idêntico** ao anterior em todos os cenários testados
- [ ] Digests de `test:pack` idênticos à baseline
- [ ] Fixtures 195 intocadas
- [ ] Registro 222 com 31 entradas na ordem exata, verificado por asserção de array completo (não por `contains`)
- [ ] `narration_summaries` ausente sem que nada lance
- [ ] Cobertura ≥ baseline

### Definition of Done — Fase 2.2

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `provider-scope.test.ts` cobre o novo arquivo de registro
- [ ] `single-source-of-truth.test.ts` passa

### Senior QA review — Fase 2.2 `[tier:heavy]`

Contexto: registro 222 completo, diff de `betas.ts`, `betas-2.1.222.test.ts`, header `anthropic-beta` gerado para 195 antes/depois em ≥3 configurações.

Foco:

1. Header do 195 mudou em **qualquer** configuração? Regressão.
2. Tornar o passo 7 condicional afetou a ordem quando outros betas também estão ausentes? Testar com múltiplas ausências simultâneas.
3. A asserção de ordem é sobre o array **completo** ou usa `contains`/`toContain`? `contains` não pega reordenação — que é exatamente o risco de D1.
4. Falta algum efeito colateral da remoção de `narration_summaries`: `ClaudeCodeBetaPolicy.narrationSummariesEnabled` agora é um campo morto para o 222 — está documentado, ou vira armadilha?
5. Os 3 conjuntos derivados foram **extraídos** do 222 ou **assumidos** iguais ao 195?

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 2.3 — Catálogo de modelos 2.1.222

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/profiles/claude-code-2.1.195.ts, src/model-capabilities.ts, docs/protocol/versions/claude-code-2.1.222-analysis.md
```

- [ ] Fase 2.2 fechada, QA sem achados; gates verdes
- [ ] Confirmar dados extraídos para os 17 modelos: capabilities, `context`, `maxOutputTokens`, `default_effort`
- [ ] Confirmar se `refusal_fallback` e `opus_5_prompt_bundle` exigem novos campos em `ClaudeCodeCapabilities` (→ toca `contracts.ts`, serializado) ou se são inertes para a construção do request
- [ ] Confirmar se `claude-mythos-5` agora **está** em `supportedModels` do 222 (D5 sugere que sim) — muda o tratamento da assimetria da Fase 1.2

### Tasks

#### T2.3.1 — Extensão de capabilities `[tier:medium]` — **SERIALIZADO** (`contracts.ts`), só se necessário

```
OWNS:   src/contracts.ts
READS:  docs/protocol/versions/claude-code-2.1.222-analysis.md
```

- **ST2.3.1.1** Se `refusal_fallback` / `opus_5_prompt_bundle` afetam a construção do request, adicionar a `ClaudeCodeCapabilities`. Se são inertes, **não adicionar** — registrar a decisão em `source-trace.md`.
- **ST2.3.1.2** Campos novos opcionais, sem quebra de tipo público.
- Commit: `refactor: extend capability contract for 2.1.222` (pular se desnecessário)

#### T2.3.2 — Catálogo 222 `[tier:medium]`

```
OWNS:   src/profiles/claude-code-2.1.222.ts
READS:  src/profiles/claude-code-2.1.195.ts, src/contracts.ts, src/profiles/beta-registry-2.1.222.ts, docs/protocol/versions/claude-code-2.1.222-analysis.md
FORBID: src/profiles/claude-code-2.1.195.ts, src/index.ts, package.json
```

- **ST2.3.2.1** 17 modelos na ordem exata do 222.
- **ST2.3.2.2** Capabilities por modelo com os deltas de D3 aplicados: `opus-4-6` **sem** `fast_mode`; `opus-4-7` **sem** `fast_mode`; `fable-5` **com** `refusal_fallback`.
- **ST2.3.2.3** `maxOutputTokens` para os 17.
- **ST2.3.2.4** Blocos `context` incluindo `supports1mBeta`, com `claude-mythos-5` agora no catálogo (D5).
- **ST2.3.2.5** Escalares do profile: `cliVersion: "2.1.222"`, `userAgent`, `buildTime`, `gitSha`, `id`. **Extrair do binário — nunca inventar.** Se `buildTime`/`gitSha` não forem extraíveis, isso é um bloqueio: escale, não invente.
- **ST2.3.2.6** `sdkVersion: "0.94.0"`, `anthropicVersion: "2023-06-01"`, endpoints — confirmados idênticos.
- **ST2.3.2.7** Header SPDX conforme `public-files.test.ts`.
- Commit: `feat: add claude-code 2.1.222 profile catalogue`

#### T2.3.3 — Registrar o profile `[tier:medium]` — **SERIALIZADO** (alto contágio)

```
OWNS:   src/index.ts, package.json, src/build-request.ts
READS:  src/profiles/claude-code-2.1.222.ts
```

- **ST2.3.3.1** Exportar `CLAUDE_CODE_2_1_222_PROFILE` de `src/index.ts`, **preservando** o export do 195.
- **ST2.3.3.2** Adicionar o subpath export `./profiles/claude-code-2.1.222` em `package.json`, espelhando o padrão existente.
- **ST2.3.3.3** Adicionar ao registro de profiles aceitos em `build-request.ts`.
- **ST2.3.3.4** **Não trocar o default ainda.** A troca é T2.3.6, deliberadamente separada.
- Commit: `feat: export 2.1.222 profile`

#### T2.3.5 — Preservar o canário antes da troca de default `[tier:medium]` — **SERIALIZADO, obrigatoriamente ANTES de T2.3.6**

```
OWNS:   scripts/verify-packed-consumers.mjs
READS:  src/index.ts, src/profiles/**
FORBID: src/**, package.json
```

Justificativa: `verify-packed-consumers.mjs` hoje exercita `buildClaudeCodeRequest` **sem profile explícito** e compara 3 digests cross-runtime. Quando o default trocar, os 3 digests mudam juntos e o canário de não-regressão do plano perde o sinal no pior momento possível.

- **ST2.3.5.1** Alterar o script para exercitar **cada profile explicitamente**, produzindo um conjunto de 3 digests por profile.
- **ST2.3.5.2** Manter a asserção de igualdade cross-runtime **por profile**.
- **ST2.3.5.3** Verificar que o digest do 195 sob profile explícito é **idêntico** ao digest da baseline da Fase 0.1. Se não for, há regressão acumulada nas Waves 1–2 — **PARE e investigue**.
- **ST2.3.5.4** Registrar o digest do 222 como nova baseline própria.
- Commit: `chore: exercise packed consumers per explicit profile`

#### T2.3.6 — Trocar o default para 2.1.222 `[tier:medium]` — **SERIALIZADO, commit isolado**

```
OWNS:   src/build-request.ts
READS:  src/profiles/**, src/index.ts
FORBID: src/index.ts, package.json, scripts/**
```

- **ST2.3.6.1** Conforme A2=(b): quando o chamador não passa profile, usar `CLAUDE_CODE_2_1_222_PROFILE`.
- **ST2.3.6.2** `CLAUDE_CODE_2_1_195_PROFILE` continua exportado, aceito e coberto — apenas deixa de ser implícito.
- **ST2.3.6.3** Este commit é **isolado e reversível**. Nada mais entra nele. É o ponto de mudança de comportamento de todo o plano.
- **ST2.3.6.4** Confirmar que o digest do 195 sob profile explícito permanece idêntico à baseline **depois** da troca.
- Commit: `feat!: default to claude-code 2.1.222 profile`

**Nota de execução:** T2.3.5 e T2.3.6 não podem ser fundidas nem reordenadas. A separação existe para que a troca de default seja um diff de uma linha, revisável e revertível, com o canário já reconfigurado.

#### T2.3.4 — Registrar na matriz de teste `[tier:medium]`

```
OWNS:   test/support/profile-matrix.ts
READS:  src/profiles/claude-code-2.1.222.ts
```

- **ST2.3.4.1** Adicionar o 222 ao registro. Isso deve **automaticamente** ampliar todas as suítes parametrizadas — se não ampliar, a Fase 0.3 falhou.
- **ST2.3.4.2** Rodar a suíte completa e triar cada falha: falha esperada (dado 222 legitimamente diferente) vs. falha real.
- Commit: `test: register 2.1.222 in profile matrix`

### Testes novos da fase

- `test/validation/catalogue-2.1.222.test.ts`:
  - 17 modelos, ordem exata, asserção de array completo
  - Capabilities por modelo, célula a célula (17 × N capabilities)
  - Os 3 deltas de D3 asseridos **explicitamente e por nome** — são o núcleo do risco
  - `maxOutputTokens` por modelo
  - `supports1mBeta` por modelo, com a lista de exclusão preservada
  - Edge: `claude-sonnet-5` / `claude-opus-5` / `claude-mythos-5` resolvem capabilities e limites; ids do 195 que não existem no 222 (se houver); id com sufixo `[1m]`; id desconhecido
- Teste cross-profile: para um mesmo id presente nos dois catálogos, asserir os deltas conhecidos e asserir **igualdade** em tudo o mais. Este teste é o que pega um erro de transcrição — copiar o catálogo 195 e editar à mão é o modo de falha mais provável desta fase.
- Ampliação automática via `profile-matrix` — verificar que a contagem de casos aproximadamente dobrou nas suítes parametrizadas

### Critério de aceitação — Fase 2.3

- [ ] Todas as suítes parametrizadas rodam para os dois profiles
- [ ] **Comportamento do 195 sob profile explícito inalterado**: fixtures 195 intocadas, digests de `test:pack` para o profile 195 idênticos à baseline da Fase 0.1 — verificado **antes e depois** da troca de default
- [ ] Default resolve para `2.1.222` quando nenhum profile é passado; commit da troca é isolado e revertível
- [ ] Digest do 222 registrado como nova baseline própria
- [ ] Teste cross-profile passa, provando que só os deltas conhecidos diferem
- [ ] `profile-coverage.test.ts` passa com dois profiles
- [ ] `provider-scope.test.ts` cobre o novo arquivo de profile
- [ ] `public-path-coverage.test.ts` passa com o novo subpath export
- [ ] `pack:check` passa (`attw --profile esm-only` com o novo export)
- [ ] Cobertura ≥ baseline

### Definition of Done — Fase 2.3

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `package-policy.test.ts` e `release-policy.test.ts` passam
- [ ] `test:pack` roda nos 3 runtimes com o novo export resolvível
- [ ] Nenhum escalar do profile foi inventado — todos extraídos e rastreáveis ao documento de análise

### Senior QA review — Fase 2.3 `[tier:heavy]`

Contexto: catálogo 222 completo, diff de `index.ts`/`package.json`/`build-request.ts`, `catalogue-2.1.222.test.ts`, teste cross-profile, contagem de casos antes/depois, digests de `test:pack`.

Foco:

1. **Erro de transcrição.** Compare o catálogo 222 contra o documento de análise entrada por entrada. Este é o maior risco da wave inteira. Não confie no teste — o teste foi escrito pela mesma cadeia que escreveu o catálogo.
2. Os 3 deltas de D3 estão corretos e na direção certa? `fast_mode` **removido** de `opus-4-6` e `opus-4-7`, não adicionado. `refusal_fallback` **adicionado** a `fable-5`.
3. `buildTime` e `gitSha` do 222 foram extraídos do binário ou plausivelmente inventados? Um valor inventado destrói a proposta de valor do pacote.
4. O novo subpath export resolve nos 3 runtimes, ou só no Node?
5. A ampliação automática realmente ocorreu, ou alguma suíte silenciosamente continua rodando só para o 195?
6. Comportamento do 195 é bit-idêntico? Qualquer mudança é regressão.

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 2.4 — Golden fixtures do 2.1.222

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  test/fixtures/golden/**, test/conformance/**, scripts/seal-golden-fixtures.mjs
```

- [ ] Fase 2.3 fechada, QA sem achados; gates verdes
- [ ] `npm run fixtures:check` exit 0
- [ ] Confirmar a estrutura exata das fixtures existentes (`outgoing-foreground.json`, `outgoing-canary-context-hint-off.json`)
- [ ] Confirmar como `reference-adapter.ts` reconstrói `ClaudeCodeRequestInput` a partir de uma fixture — as fixtures 222 precisam ser compatíveis com esse caminho

### Tasks

#### T2.4.1 — Autoria das fixtures `[tier:medium]`

```
OWNS:   test/fixtures/golden/outgoing-foreground-2.1.222.json, test/fixtures/golden/outgoing-canary-context-hint-off-2.1.222.json
READS:  test/fixtures/golden/*, src/profiles/claude-code-2.1.222.ts
FORBID: test/fixtures/golden/manifest.json (propriedade de fixtures:seal), docs/source-trace.md
```

- **ST2.4.1.1** Espelhar os cenários das fixtures 195 com o profile 222, mudando **apenas** o que o 222 muda.
- **ST2.4.1.2** Nenhuma credencial real; token sintético no mesmo padrão das existentes.
- **ST2.4.1.3** Formatação byte-consistente com as existentes (indentação, ordem de chaves, newline final).
- Commit: `test: add 2.1.222 golden fixtures`

#### T2.4.2 — Selagem `[tier:medium]` — **SERIALIZADO**

```
OWNS:   test/fixtures/golden/manifest.json, docs/source-trace.md
READS:  test/fixtures/golden/*
```

- **ST2.4.2.1** Rodar `npm run fixtures:seal` em árvore limpa.
- **ST2.4.2.2** Inspecionar o diff manualmente — deve conter **apenas** as duas entradas novas.
- **ST2.4.2.3** Verificar que `source-trace-integrity.test.ts` passa.
- Commit: `test: seal 2.1.222 fixture hashes`

#### T2.4.3 — Conformance diferencial `[tier:medium]`

```
OWNS:   test/conformance/differential.test.ts, test/conformance/reference-adapter.ts
READS:  test/fixtures/golden/*
```

- **ST2.4.3.1** Estender o adapter para carregar fixtures 222.
- **ST2.4.3.2** Estender o teste diferencial para reconstruir e comparar as fixtures 222.
- **ST2.4.3.3** **Não enfraquecer** as asserções existentes do 195.
- Commit: `test: extend differential conformance to 2.1.222`

### Testes novos da fase

- Duas fixtures novas + cobertura diferencial
- Edge: fixture com `contextHintEnabled` divergente entre profiles; fixture com um modelo que só existe no 222 (`claude-opus-5`); fixture exercitando um beta que só existe no 222 (`prompt-caching-evict`)
- Teste negativo: alterar 1 byte de uma fixture 222 → `fixtures:check` **e** `differential.test.ts` ambos falham (mutação + revert)

### Critério de aceitação — Fase 2.4

- [ ] `npm run fixtures:check` exit 0
- [ ] `source-trace-integrity.test.ts` passa com 4 fixtures
- [ ] `differential.test.ts` passa para os dois profiles
- [ ] Fixtures 195 e seus hashes **inalterados** — verificar por diff
- [ ] Mutação de 1 byte é detectada pelos dois mecanismos
- [ ] Nenhuma credencial real em nenhuma fixture (grep por padrão de token)

### Definition of Done — Fase 2.4

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] Diff do `manifest.json` contém exatamente 2 linhas novas
- [ ] Diff de `docs/source-trace.md` restrito à seção `### Fixture integrity`

### Senior QA review — Fase 2.4 `[tier:heavy]`

Contexto: as 2 fixtures novas, diffs de `manifest.json` e `source-trace.md`, diff de `differential.test.ts`/`reference-adapter.ts`.

Foco:

1. As fixtures 222 foram **derivadas do builder** ou **escritas à mão a partir do que esperamos**? Se derivadas do builder, o teste diferencial é circular e não prova nada. Este é o risco central desta fase. Se forem circulares, é preciso um oráculo externo — comparação contra o comportamento do binário 222.
2. Alguma fixture 195 mudou, mesmo em whitespace?
3. O adapter estendido continua validando shape com o mesmo rigor para os dois profiles?
4. Há credencial, path local ou identificador de máquina em alguma fixture?

**Nota crítica sobre circularidade:** este é o único ponto do plano em que a corrente de evidência pode se fechar sobre si mesma. Se o QA review concluir que as fixtures são circulares, isso é um **problema crítico** — pare e escale antes de prosseguir, porque significa que a Wave 2 inteira não está sendo verificada contra nada externo.

Corrigir todos. Commit `fix:`. Re-rodar.

### Fechamento da Wave 2

- [ ] QA das 4 fases sem achados abertos
- [ ] Comportamento do 195 provadamente inalterado desde a baseline
- [ ] Merge em `main`

---

# WAVE 3 — Semântica de divergência

**Objetivo:** tratar as divergências que não são dado puro e exigem decisão de comportamento.

---

## Fase 3.1 — Overrides de `max_tokens` (D4)

**Escopo depende de A1.** Se A1 = (c), esta fase é apenas documentação.

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/thinking.ts, src/request-body.ts, docs/source-trace.md
```

- [ ] Wave 2 mergeada; branch `feat/upstream-2.1.222-wave-3`; gates verdes
- [ ] **A1 respondida e registrada em `docs/source-trace.md`**
- [ ] Confirmar a semântica exata do override (2) no binário 222: `if (request.max_tokens >= 4096) upper = request.max_tokens; default = min(default, upper)`
- [ ] Confirmar se o override se aplica antes ou depois de `clampMaxTokens` — a ordem muda o resultado

### Tasks (assumindo A1 = (b))

#### T3.1.1 — Override derivado do request `[tier:medium]`

```
OWNS:   src/thinking.ts
READS:  src/profiles/**, src/contracts.ts
FORBID: src/request-body.ts, src/contracts.ts
```

- **ST3.1.1.1** Implementar: quando `max_tokens` solicitado ≥ 4096, `upper = requested`, `default = min(default, upper)`.
- **ST3.1.1.2** Aplicar **somente** para o profile 222. O 195 não tem esse comportamento.
- **ST3.1.1.3** Preservar `clampMaxTokens` e a ordem de chaves do `thinking`.
- Commit: `feat: apply request-derived output token upper bound for 2.1.222`

#### T3.1.2 — Documentar o que ficou fora `[tier:medium]` — **SERIALIZADO**

```
OWNS:   docs/source-trace.md
READS:  docs/protocol/versions/claude-code-2.1.222-analysis.md
FORBID: test/fixtures/golden/**
```

- **ST3.1.2.1** Registrar o override de remote-config (`heather_vale`) como divergência **consciente e permanente**, com justificativa arquitetural (sem I/O).
- **ST3.1.2.2** Não tocar a seção de fixtures.
- Commit: `docs: record deliberate divergence on remote-config token override`

### Testes novos da fase

- `test/validation/token-override-2.1.222.test.ts`:
  - `max_tokens` = 4095 → sem override; = 4096 → override (borda exata)
  - `max_tokens` acima do `upper` do catálogo → `upper` sobe
  - `max_tokens` abaixo do `default` → `default` desce
  - Interação com `budget_tokens`: `min(maxTokens-1, requested)` sob override
  - Profile 195 com o mesmo input → **sem** override (prova de isolamento por profile)
  - Edge: `max_tokens` = 0, negativo, não-inteiro, `Number.MAX_SAFE_INTEGER`, `NaN`, `Infinity`

### Critério de aceitação — Fase 3.1

- [ ] Comportamento do 195 inalterado; fixtures 195 e digests intocados
- [ ] Borda em 4096 asserida nos dois lados
- [ ] Divergência permanente documentada
- [ ] Entradas inválidas rejeitadas ou tratadas de forma definida (não `NaN` silencioso)

### Definition of Done — Fase 3.1

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `fixtures:check` exit 0

### Senior QA review — Fase 3.1 `[tier:heavy]`

Foco:

1. A ordem de aplicação (override antes/depois de clamp) bate com o binário 222, ou foi assumida?
2. `NaN`/`Infinity` propagam para `budget_tokens` e viram um corpo de request inválido?
3. O isolamento por profile é estrutural ou um `if (profile.cliVersion === "2.1.222")` espalhado? A segunda forma não escala para a próxima versão.
4. A divergência documentada é acionável para o consumidor, ou só uma nota?

---

## Fase 3.2 — Billing header `cc_prev_req` (D7)

**Justificativa:** o 222 encadeia requests consecutivos anexando `cc_prev_req=<requestId>;` ao billing header, onde `requestId` é o `request-id` retornado pela chamada anterior da API. É wire-visible. Um consumidor no profile 222 que não emita esse campo produz requests distinguíveis de um Claude Code real a partir do segundo turno da conversa.

**Dificuldade arquitetural:** o valor é um dado de **resposta**, não de request. O pacote hoje não modela nada de resposta. Isso obriga a expandir a superfície pública com um input que o chamador precisa alimentar a partir do header `request-id` da chamada anterior.

### Pre-flight check `[tier:fast]`

```
OWNS:   (nenhum)
READS:  src/fingerprint.ts, src/build-request.ts, src/system-prompt.ts, src/contracts.ts, docs/source-trace.md
```

- [ ] Fase 3.1 fechada, QA sem achados; gates verdes
- [ ] Reextrair do dump 222 a função builder completa do billing header e a função de recuperação do `requestId`, verbatim. **Não confiar no registro deste plano** — reverificar.
- [ ] Determinar a **posição exata** de `cc_prev_req` no template: antes ou depois de `cch=`? Com que separador e espaçamento? Isto é byte-significativo.
- [ ] Determinar o gate exato: só first-party? Só quando existe request anterior? O que acontece no primeiro turno?
- [ ] Confirmar se o `requestId` recuperado é o da última mensagem `assistant` **com** `requestId`, pulando as sem — e o que ocorre quando nenhuma tem.
- [ ] Confirmar se o 195 realmente **não** tem esse campo (ausência é a asserção que protege o profile 195)

### Tasks

#### T3.2.1 — Contrato de entrada `[tier:medium]` — **SERIALIZADO** (`contracts.ts`)

```
OWNS:   src/contracts.ts
READS:  src/fingerprint.ts, src/build-request.ts
FORBID: src/fingerprint.ts, src/build-request.ts, src/index.ts
```

- **ST3.2.1.1** Adicionar input opcional `previousRequestId?: string` a `ClaudeCodeRequestInput`.
- **ST3.2.1.2** Documentar no tipo, de forma inequívoca, que o valor vem do header `request-id` da resposta anterior da API — e que omiti-lo no profile 222, em conversa multi-turn, produz um request divergente do CLI real.
- **ST3.2.1.3** Opcional, para não quebrar chamadores existentes. Verificar com `public-api.test-d.ts`.
- Commit: `refactor: accept previous request id as builder input`

#### T3.2.2 — Composição do billing header `[tier:medium]`

```
OWNS:   src/fingerprint.ts
READS:  src/contracts.ts, src/profiles/**, docs/protocol/versions/claude-code-2.1.222-analysis.md
FORBID: src/contracts.ts, src/build-request.ts
```

- **ST3.2.2.1** Estender `createBillingBlock` para aceitar o `previousRequestId` e o profile.
- **ST3.2.2.2** Emitir `cc_prev_req=<id>;` **apenas** para o profile 222, **apenas** quando o id está presente, na posição e com o espaçamento exatos verificados no pre-flight.
- **ST3.2.2.3** Profile 195: comportamento **byte-idêntico** ao atual. O campo nunca aparece.
- **ST3.2.2.4** Não alterar o algoritmo do fingerprint — ele foi verificado como inalterado e não faz parte desta mudança.
- Commit: `feat: emit cc_prev_req in 2.1.222 billing header`

#### T3.2.3 — Ligação no builder `[tier:medium]` — **SERIALIZADO**

```
OWNS:   src/build-request.ts
READS:  src/fingerprint.ts, src/contracts.ts
FORBID: src/fingerprint.ts, src/contracts.ts
```

- **ST3.2.3.1** Repassar `previousRequestId` ao `createBillingBlock`.
- **ST3.2.3.2** **Decidir e documentar** se o pacote deriva o id do histórico de mensagens (espelhando `gfb` do upstream) ou exige que o chamador o forneça. Preferir exigir do chamador: derivar exigiria que as mensagens carregassem `requestId`, que não é campo do wire da Messages API e poluiria o tipo `Message`.
- **ST3.2.3.3** Se a decisão for exigir do chamador, isso é uma divergência de conveniência em relação ao upstream — documentar em `docs/source-trace.md`.
- Commit: `feat: wire previous request id into billing block`

#### T3.2.4 — Vetor conhecido do fingerprint 222 `[tier:medium]`

```
OWNS:   test/fingerprint-2.1.222.test.ts
READS:  src/fingerprint.ts, docs/source-trace.md
```

- **ST3.2.4.1** Computar o fingerprint de 3 hex para o profile 222 usando o mesmo texto de sonda do vetor 195 (`offline cch probe`) com `cliVersion: "2.1.222"`.
- **ST3.2.4.2** Travar o valor como known-answer vector, no mesmo padrão de `test/fingerprint.test.ts`.
- **ST3.2.4.3** Asserir a linha de billing completa do 222, com e sem `cc_prev_req`.
- **ST3.2.4.4** Registrar o vetor em `docs/source-trace.md` — **serializar** com T3.2.5.
- Commit: `test: pin 2.1.222 billing fingerprint vector`

#### T3.2.5 — Documentação `[tier:medium]` — **SERIALIZADO**

```
OWNS:   docs/source-trace.md
READS:  test/fingerprint-2.1.222.test.ts
FORBID: test/fixtures/golden/**
```

- **ST3.2.5.1** Registrar D7, o vetor conhecido do 222, e a decisão de T3.2.3.2.
- **ST3.2.5.2** Reafirmar que o algoritmo do fingerprint não mudou e que a proibição de xxHash permanece válida no 222.
- **ST3.2.5.3** Não tocar a seção `### Fixture integrity`.
- Commit: `docs: record cc_prev_req divergence and 2.1.222 fingerprint vector`

### Testes novos da fase

- `test/fingerprint-2.1.222.test.ts` — vetor conhecido + composição da linha completa
- `test/validation/billing-prev-req.test.ts`:
  - Profile 222 sem `previousRequestId` → campo **ausente**, linha byte-idêntica à do primeiro turno
  - Profile 222 com `previousRequestId` → campo presente, posição e espaçamento exatos
  - Profile 195 com `previousRequestId` fornecido → campo **ausente** (isolamento por profile)
  - Edge: id vazio; id com espaço; id com `;`; id com caractere de controle (deve ser rejeitado — o billing block é texto, mas injeção de `;` corromperia o parsing do lado do servidor); id extremamente longo; id `undefined` explícito vs. ausente
  - Interação: `cc_prev_req` presente **e** `cch=00000` presente — ordem relativa correta
  - Interação: `attributionEnabled` falsy suprime o billing header inteiro, incluindo `cc_prev_req`
- Ampliar a suíte parametrizada de system-prompt para cobrir os dois profiles

### Critério de aceitação — Fase 3.2

- [ ] Billing header do 195 **byte-idêntico** ao anterior em todos os cenários, inclusive com `previousRequestId` fornecido
- [ ] Digest do `test:pack` para o profile 195 idêntico à baseline da Fase 0.1
- [ ] Fixtures 195 intocadas
- [ ] Posição, separador e espaçamento de `cc_prev_req` verificados contra o binário, não assumidos
- [ ] Vetor conhecido do 222 travado e registrado em `docs/source-trace.md`
- [ ] Injeção via `;` ou caractere de controle no id é rejeitada
- [ ] `public-api.test-d.ts` passa

### Definition of Done — Fase 3.2

- [ ] Critérios satisfeitos, gates completos verdes
- [ ] `source-trace-integrity.test.ts` passa
- [ ] `contracts.ts` tocado por exatamente um commit isolado
- [ ] Decisão de T3.2.3.2 documentada e justificada

### Senior QA review — Fase 3.2 `[tier:heavy]`

Contexto a injetar: extração verbatim do builder de billing do 222, `fingerprint.ts` antes/depois, diffs de `contracts.ts` e `build-request.ts`, os dois arquivos de teste novos, e a linha de billing gerada para 195 e 222 em ≥4 configurações.

Foco:

1. **A posição de `cc_prev_req` no template foi verificada contra o binário ou inferida?** O template do 222 tem 4 segmentos interpolados contra 3 no 195. Errar a ordem produz uma linha sintaticamente plausível e semanticamente errada — o pior tipo de bug para este pacote.
2. O billing header do 195 mudou em **qualquer** configuração, inclusive quando `previousRequestId` é passado por engano? Deve ser ignorado silenciosamente ou rejeitado — decidir qual e ser consistente.
3. O id é interpolado em texto sem sanitização? Um `;` no valor quebra o parsing do lado do servidor. Há validação?
4. A decisão de exigir o id do chamador em vez de derivá-lo do histórico está documentada como divergência, ou passou como detalhe de implementação?
5. O vetor conhecido do 222 foi **computado** ou copiado de algum lugar? Se computado pelo nosso próprio código, é circular — precisa de verificação independente (computar o SHA-256 à mão a partir do material documentado).
6. `attributionEnabled` falsy realmente suprime tudo, ou sobrou um fragmento?

Corrigir todos. Commit `fix:`. Re-rodar.

---

## Fase 3.3 — Fechamento de arestas de divergência

### Pre-flight check `[tier:fast]`

- [ ] Fase 3.2 fechada, QA sem achados; gates verdes
- [ ] Revisitar D5 (predicado 1M) e D6 (schema de catálogo) e confirmar se restou dívida das Waves 1–2

### Tasks

- **T3.3.1** `[tier:medium]` — Consolidar o predicado 1M: 222 deriva puramente do catálogo; 195 preserva o caso especial `claude-mythos-5`. `OWNS: src/model-capabilities.ts` ou o arquivo que hospeda o predicado.
- **T3.3.2** `[tier:medium]` — Avaliar se campos do schema 222 hoje não modelados (`default_effort`, `pricing`, `fallback_chain`, `advisor_rank`, `image_limits`) afetam a construção do request. Modelar apenas os que afetam; documentar os demais como fora de escopo. `OWNS: docs/source-trace.md` (serializado) + eventual `src/contracts.ts` (serializado).
- **T3.3.3** `[tier:medium]` — Varredura final do `profile-coupling-map.md`: toda ocorrência classificada como `ACOPLAMENTO` foi resolvida?
- **T3.3.4** `[tier:medium]` — Centralizar o despacho por versão. Ao final da Wave 3 haverá pelo menos três comportamentos condicionados a profile (override de `max_tokens`, `cc_prev_req`, predicado 1M). Se estiverem espalhados como `if (cliVersion === "2.1.222")`, consolidar num único ponto de despacho declarativo antes de fechar a wave. `OWNS: o arquivo de despacho a criar` — serializado.

### Testes novos da fase

- Predicado 1M por profile, para os 17 modelos + a lista de exclusão + `claude-mythos-5` nos dois profiles
- Teste de governança: nenhum `if` comparando `cliVersion` literal fora do ponto de despacho aprovado e demarcado. Edge: comentário citando a versão não deve gerar falso positivo (reusar `stripComments` de `provider-scope.test.ts`)

### Critério de aceitação — Fase 3.3

- [ ] Zero item `ACOPLAMENTO` pendente no mapa
- [ ] Predicado 1M correto nos dois profiles, incluindo a assimetria do mythos-5
- [ ] Campos não modelados documentados
- [ ] Todo comportamento condicionado a versão passa por um único ponto de despacho
- [ ] Digest do `test:pack` para o profile 195 idêntico à baseline da Fase 0.1

### DoD e QA review — Fase 3.3

Padrão. Foco do QA `[tier:heavy]`: o despacho por versão está centralizado ou espalhado? Espalhamento aqui é dívida que a próxima versão paga com juros. Verificar também se a centralização não introduziu indireção que torne o comportamento de cada profile difícil de auditar — o pacote precisa continuar sendo legível como especificação.

### Fechamento da Wave 3

- [ ] QA sem achados abertos; merge em `main`

---

# WAVE 4 — Sustentabilidade e release

**Objetivo:** garantir que a **próxima** versão do CLI custe uma fração desta migração. Esta é a wave que realmente entrega "acompanhar upstream".

---

## Fase 4.1 — Tooling de detecção de drift de versão

### Pre-flight check `[tier:fast]`

- [ ] Wave 3 mergeada; branch `feat/upstream-2.1.222-wave-4`; gates verdes
- [ ] Revisar o que **de fato** custou tempo nas Waves 2–3 e priorizar automação por custo real, não por elegância

### Tasks

- **T4.1.1** `[tier:medium]` — `scripts/extract-upstream-profile.mjs`: dado um dump de string de um binário do CLI, extrair registro de betas, catálogo de modelos, capabilities, limites de token e escalares, emitindo um relatório estruturado. `OWNS: scripts/extract-upstream-profile.mjs`
- **T4.1.2** `[tier:medium]` — Testes com fixtures sintéticas, no padrão de `test/drift/`. `OWNS: test/tooling/extract-upstream-profile.test.ts, test/tooling/fixtures/**`
- **T4.1.3** `[tier:medium]` — `docs/plans/UPSTREAM-TRACKING-RUNBOOK.md`: procedimento passo a passo para a próxima versão, com os gates que quebram e a ordem de ataque. `OWNS: docs/plans/UPSTREAM-TRACKING-RUNBOOK.md`
- **T4.1.4** `[tier:medium]` — **SERIALIZADO**: wiring de npm script + CI + `ci-policy.test.ts`. `OWNS: package.json, .github/workflows/ci.yml, test/governance/ci-policy.test.ts`

### Testes novos da fase

- Extração contra fixtures sintéticas: registro bem formado; registro com entrada `null` (o 222 tem uma); catálogo com modelo desconhecido; dump truncado; dump vazio; dump sem os anchors esperados
- Teste de governança: o runbook cita apenas arquivos que existem

### Critério de aceitação — Fase 4.1

- [ ] Extrator roda contra os dumps reais de 195 e 222 e produz saída consistente com os catálogos commitados
- [ ] Runbook executável por alguém sem contexto deste plano
- [ ] Todos os edge cases cobertos

### DoD e QA review — Fase 4.1

Padrão. Foco do QA `[tier:heavy]`: o extrator é robusto a mudança de minificação, ou quebra na primeira versão que renomear identificadores? Se depende de nomes minificados, é uma ferramenta descartável — o QA precisa dizer isso explicitamente.

---

## Fase 4.2 — Release

### Pre-flight check `[tier:fast]`

- [ ] Fase 4.1 fechada, QA sem achados
- [ ] **Todos** os gates verdes
- [ ] A3 respondida (número de versão)
- [ ] `release-policy.test.ts` lido e seus requisitos enumerados

### Tasks

- **T4.2.1** `[tier:medium]` — **SERIALIZADO**: `CHANGELOG.md` + bump em `package.json`, com heading de release-candidate batendo com a versão, e prerelease sem data conforme a política. `OWNS: CHANGELOG.md, package.json`
- **T4.2.2** `[tier:medium]` — README: documentar os dois profiles, como selecionar, e que o default permanece 195. `OWNS: README.md`
- **T4.2.3** `[tier:fast]` — Verificação final do allowlist de arquivos publicados e ausência de credenciais.

### Critério de aceitação — Fase 4.2

- [ ] `release-policy.test.ts`, `package-policy.test.ts`, `public-files.test.ts` passam
- [ ] `npm run pack:check` e `npm run test:pack` passam
- [ ] `npm pack --dry-run` contém exatamente o allowlist
- [ ] README documenta os dois profiles

### DoD — Fase 4.2

- [ ] Critérios satisfeitos, todos os gates verdes
- [ ] CHANGELOG descreve as mudanças em termos de consumidor, não de implementação

### Senior QA review — Fase 4.2 `[tier:heavy]`

Foco: o CHANGELOG comunica corretamente que o default **não** mudou? Um consumidor lendo só o CHANGELOG entenderia como adotar o 222? Há alguma mudança breaking não declarada?

---

## 6. Critérios globais

### 6.1 Aceitação global

- [ ] **Comportamento do 195 sob profile explícito bit-idêntico à baseline da Fase 0.1.** Provado por: digests de `test:pack` do profile 195 iguais; fixtures 195 e seus hashes intocados; `differential.test.ts` verde.
- [ ] **Default resolve para `2.1.222`** quando nenhum profile é passado (A2=b), com o commit da troca isolado e revertível, e digest próprio registrado como baseline do 222.
- [ ] Profile `2.1.195` continua exportado, aceito, coberto por fixtures e verificável — deixou de ser implícito, não de existir.
- [ ] Todas as suítes parametrizadas rodam para os dois profiles; `profile-coverage.test.ts` garante que um profile futuro não nasce meio testado.
- [ ] **D1–D7** tratadas: implementadas, ou documentadas como divergência consciente e permanente em `docs/source-trace.md` com justificativa.
- [ ] Fingerprint de billing: algoritmo confirmado inalterado; vetor conhecido do 222 computado, verificado de forma independente e travado em teste; proibição de xxHash mantida.
- [ ] `cc_prev_req` emitido apenas no profile 222, apenas quando o id existe, na posição verificada contra o binário, com o valor sanitizado.
- [ ] Todo comportamento condicionado a versão passa por um único ponto de despacho auditável.
- [ ] Fonte de verdade única: capabilities e limites de token derivam do catálogo; `single-source-of-truth.test.ts` impede regressão.
- [ ] Todos os 9 testes de governança passam, incluindo `provider-scope.test.ts` cobrindo os dois profiles.
- [ ] Cobertura ≥ baseline nas 4 métricas.
- [ ] `fixtures:check` e `fixtures:seal` funcionais; hashes nunca mais editados à mão.
- [ ] Runbook de upstream tracking existe e é executável sem contexto deste plano.
- [ ] Zero credencial, path local ou artefato de processo em arquivo publicado.
- [ ] Escopo `provider: "anthropic"` preservado; nenhum literal de provider estrangeiro em `src/`.

### 6.2 Definition of Done global

- [ ] Todos os critérios de aceitação globais satisfeitos
- [ ] Toda fase tem pre-flight registrado, QA review fechado, e todos os achados corrigidos e commitados
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:coverage && npm run build && npm run pack:check && npm run test:pack && npx vitest run test/drift && npm run fixtures:check` — todos exit 0
- [ ] `npm run drift:check` sai 0 (com upstream presente) ou 2 `SOURCE_UNAVAILABLE` (sem) — nunca suprimido
- [ ] Histórico de commits: conventional, signed-off, sem commit deixando a árvore vermelha, sem arquivo ignorado commitado
- [ ] `docs/plans/BLOCKERS.md` vazio ou com todos os itens resolvidos
- [ ] Merge em `main` limpo
- [ ] CHANGELOG e versão coerentes; `release-policy.test.ts` verde

### 6.3 Senior QA review global `[tier:heavy]`

Após a Fase 4.2, um review final independente. Contexto a injetar via `[tier:fast]`: diff completo `main@6c25056..HEAD`, baseline vs. estado final de todos os gates, todos os relatórios de QA de fase, `BLOCKERS.md`.

Foco:

1. **Prova de não-regressão.** O 195 está bit-idêntico? Se qualquer digest mudou, tudo o mais é irrelevante até isso ser explicado.
2. **Circularidade de evidência.** As fixtures 222 são verificadas contra algo externo, ou só contra o nosso próprio builder? Se circulares, o suporte a 222 é auto-referencial e o pacote está mentindo sobre o que garante.
3. **Fidelidade de transcrição.** Amostrar ≥5 entradas do catálogo 222 e ≥5 do registro de betas contra o documento de análise e contra o dump do binário. Erro de transcrição é o modo de falha mais provável e o menos detectável por teste.
4. **Erosão de governança.** As 9 suítes de governança estão mais fortes ou mais fracas do que em `6c25056`? Generalizar testes é o vetor clássico de afrouxamento silencioso.
5. **Custo da próxima versão.** Estimar concretamente o esforço para adicionar `2.1.2XX`. Se não for substancialmente menor que esta migração, a Wave 1 não entregou seu propósito e isso precisa ser dito.
6. **Dívida acumulada.** Listar todo `TODO`, `FIXME`, allowlist justificado e divergência documentada introduzidos. Cada um é uma promessa. Quantas foram feitas?
7. **Superfície pública.** A API cresceu além do necessário? Cada export novo é um compromisso de compatibilidade permanente.
8. **Verificação independente de amostra.** Escolher 3 afirmações do plano marcadas como "verificado" e re-verificá-las do zero contra o binário.

**Todos os achados do review global devem ser corrigidos antes do release.** Achados que exijam mudança estrutural retornam à wave correspondente, não são remendados na Wave 4.

---

## 7. Riscos

| #   | Risco                                                                                                                                          | Prob.    | Impacto     | Mitigação                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Erro de transcrição no catálogo 222                                                                                                            | **Alta** | Alto        | Teste cross-profile; auditoria de amostra no QA de 2.3 e global                                                                          |
| R2  | Fixtures 222 circulares (verificadas contra nosso próprio builder)                                                                             | **Alta** | **Crítico** | QA dedicado na Fase 2.4; tratado como problema crítico se confirmado                                                                     |
| R3  | Refactor da Wave 1 muda comportamento sutilmente                                                                                               | Média    | **Crítico** | Digests de `test:pack` como canário em toda fase; fixtures como oráculo                                                                  |
| R4  | Afrouxamento de teste de governança ao generalizar                                                                                             | Média    | Alto        | QA compara asserção por asserção, não contagem                                                                                           |
| R5  | Script de selagem usa algoritmo de hash divergente do teste                                                                                    | Baixa    | **Crítico** | Verificação byte-a-byte contra a implementação existente antes de qualquer escrita                                                       |
| R6  | `buildTime`/`gitSha` do 222 não extraíveis do binário                                                                                          | Média    | Alto        | Tratado como bloqueio explícito — escalar, nunca inventar                                                                                |
| R7  | Extrator da Fase 4.1 depende de nomes minificados e quebra na próxima versão                                                                   | **Alta** | Médio       | QA obrigado a se pronunciar; aceitar como ferramenta descartável se for o caso                                                           |
| R8  | Conflito de escrita entre agentes paralelos                                                                                                    | Baixa    | Médio       | Ownership exclusivo declarado; arquivos de alto contágio sempre serializados                                                             |
| R9  | Cobertura cai silenciosamente ao parametrizar suítes                                                                                           | Média    | Médio       | Gate de cobertura ≥ baseline em toda fase                                                                                                |
| R10 | ~~A1 decidido tarde~~ — **resolvido**, A1=(b) definido em 2026-08-05                                                                           | —        | —           | Fechado                                                                                                                                  |
| R11 | **Troca de default (A2=b) cega o canário de não-regressão** — os 3 digests do `test:pack` mudam juntos exatamente quando mais precisamos deles | **Alta** | **Crítico** | T2.3.5 reconfigura o script para profiles explícitos **antes** de T2.3.6 trocar o default; digest do 195 permanece comparável à baseline |
| R12 | Posição errada de `cc_prev_req` no template do billing header — o 222 tem 4 segmentos interpolados contra 3 no 195                             | **Alta** | Alto        | Pre-flight da Fase 3.2 exige reextração verbatim do binário; QA obrigado a verificar posição, separador e espaçamento                    |
| R13 | Vetor conhecido do fingerprint 222 computado pelo próprio código (circular)                                                                    | Média    | Alto        | QA da Fase 3.2 exige verificação independente do SHA-256 a partir do material documentado                                                |
| R14 | Breaking change de default não comunicado adequadamente — não gera erro de compilação, consumidor descobre em produção                         | Média    | Alto        | CHANGELOG com `BREAKING CHANGE` em destaque; README documentando ambos os profiles; QA da Fase 4.2 valida a comunicação                  |
| R15 | `previousRequestId` interpolado em texto sem sanitização — `;` no valor corrompe o parsing do billing header                                   | Baixa    | Alto        | Validação explícita + casos de teste de injeção na Fase 3.2                                                                              |

---

## 8. Apêndice — Gates que quebram ao adicionar um profile

Referência rápida para a próxima versão. Todo item aqui **vai** quebrar ou precisa de atualização:

| Gate                                             | O que quebra                                                                       | Ação                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `test/governance/provider-scope.test.ts`         | Lê `src/profiles/claude-code-2.1.195.ts` por path literal                          | Generalizado na Fase 1.3 — verificar que continua genérico                 |
| `scripts/verify-drift.mjs`                       | Path literal do profile 195                                                        | Generalizado na Fase 1.3 via `--profile`                                   |
| `package.json` `exports`                         | Novo subpath necessário                                                            | Adicionar espelhando o padrão                                              |
| `test/governance/public-path-coverage.test.ts`   | Novo subpath sem cobertura                                                         | Adicionar cobertura                                                        |
| `test/governance/public-files.test.ts`           | Novo arquivo sem header SPDX                                                       | Adicionar header                                                           |
| `test/governance/package-policy.test.ts`         | Fronteira de publicação e perfil ESM-only                                          | Verificar `attw --profile esm-only`                                        |
| `test/governance/release-policy.test.ts`         | CHANGELOG vs versão; allowlist de arquivos                                         | Atualizar CHANGELOG e allowlist                                            |
| `test/governance/source-trace-integrity.test.ts` | Fixtures novas sem hash em dois lugares                                            | `npm run fixtures:seal`                                                    |
| `test/governance/ci-policy.test.ts`              | Novo gate de CI não declarado                                                      | Atualizar a lista de gates asseridos                                       |
| `src/build-request.ts`                           | Rejeição de profile único                                                          | Generalizado na Fase 1.3 via registro                                      |
| `src/index.ts`                                   | Novo export nomeado                                                                | Adicionar preservando os existentes                                        |
| `docs/protocol/versions/`                        | Falta documento de análise                                                         | Autorar seguindo o template                                                |
| `docs/source-trace.md`                           | Falta linha na tabela de profiles                                                  | Adicionar                                                                  |
| `test/support/profile-matrix.ts`                 | Profile não registrado → suítes não ampliam                                        | Registrar                                                                  |
| `test/governance/profile-coverage.test.ts`       | Profile registrado sem cobertura mínima                                            | Adicionar suítes                                                           |
| `test/fingerprint.test.ts`                       | Vetor conhecido é específico da versão — `cliVersion` entra no material do SHA-256 | Computar e travar o vetor da nova versão; verificar de forma independente  |
| `test/system-prompt.test.ts`                     | Composição da linha de billing muda se o template ganhar segmentos                 | Reextrair o template do binário; nunca inferir                             |
| `scripts/verify-packed-consumers.mjs`            | Exercita o default implícito — muda de sinal quando o default troca                | Exercitar cada profile explicitamente; registrar baseline por profile      |
| `test/governance/source-hygiene.test.ts`         | Proíbe xxHash em `src/`                                                            | Reconfirmar a cada versão que o upstream não ativou attestation via xxHash |

---

## 9. Resumo de roteamento

| Wave | Fases   | Perfil dominante                                   | Paralelismo                                                                                    |
| ---- | ------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0    | 0.1–0.3 | `[tier:fast]` inventário + `[tier:medium]` tooling | Alto na 0.3 (3 lotes disjuntos)                                                                |
| 1    | 1.1–1.3 | `[tier:medium]` refactor                           | Baixo — mudanças interdependentes em `src/`                                                    |
| 2    | 2.1–2.4 | `[tier:fast]` extração + `[tier:medium]` dados     | Médio — 2.2 e 2.3 parcialmente paralelizáveis; T2.3.5/T2.3.6 e a Fase 2.4 estritamente seriais |
| 3    | 3.1–3.3 | `[tier:medium]` + `[tier:heavy]` no design         | Baixo — Fase 3.2 quase toda serial (contracts → fingerprint → build-request → docs)            |
| 4    | 4.1–4.2 | `[tier:medium]` tooling e docs                     | Médio                                                                                          |

QA review de fase e global: sempre `[tier:heavy]`, sempre com contexto coletado previamente por `[tier:fast]` e injetado literalmente — `[tier:heavy]` não tem ferramenta de busca.

---

## 10. Adendo 2026-08-15 — Reanálise: retarget `2.1.222` → `2.1.233`

- **Data da reanálise:** 2026-08-15
- **Estado do repo na reanálise:** `main` @ `6c25056` (inalterado desde a abertura do plano); nenhuma wave iniciada; este arquivo ainda untracked.
- **Upstream na reanálise:** `latest`/`next` = `2.1.233` (publicado 2026-08-14T18:50Z), `stable` = `2.1.224`. Dez versões publicadas depois da `2.1.222` (223, 224, 225, 226, 227, 228, 229, 231, 232, 233 — `2.1.230` não existe no registro).
- **Método:** extração e diff binário direto dos artefatos oficiais win32-x64 de `2.1.222` (266 MB, `BUILD_TIME 2026-08-04T01:24:05Z`) e `2.1.233` (305 MB, `BUILD_TIME 2026-08-14T17:21:48Z`), via `npm pack` dos pacotes de plataforma. Enumeração independente por versão (não delta inferido) para registro de betas e catálogo de modelos; decompilação das funções de billing, fingerprint e resolução de `max_output_tokens`; diff completo do `sdk-tools.d.ts`.

### 10.1 Decisão de retarget

**O alvo do plano passa a ser `2.1.233`.** Justificativa: o diff 222→233 é pequeno e totalmente mapeado (abaixo); mirar a `2.1.222` entregaria um profile já obsoleto no dia do merge; e a `2.1.233` elimina o risco R6 (metadados de build extraídos com sucesso). Alternativa conservadora considerada e rejeitada: mirar o dist-tag `stable` (`2.1.224`) — rejeitada porque `stable` fica ~9 versões atrás de `latest` e o delta wire entre 224 e 233 está contido no diff já mapeado.

Consequências mecânicas (aplicar em todas as ocorrências):

| Artefato do plano    | Antes                                                    | Depois                                                                             |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Profile              | `src/profiles/claude-code-2.1.222.ts`                    | `src/profiles/claude-code-2.1.233.ts`                                              |
| Beta registry        | `src/profiles/beta-registry-2.1.222.ts`                  | `src/profiles/beta-registry-2.1.233.ts`                                            |
| Doc de análise       | `docs/protocol/versions/claude-code-2.1.222-analysis.md` | `docs/protocol/versions/claude-code-2.1.233-analysis.md`                           |
| Golden fixtures      | `outgoing-*-2.1.222.json`                                | `outgoing-*-2.1.233.json`                                                          |
| Vetor de fingerprint | `test/fingerprint-2.1.222.test.ts`                       | `test/fingerprint-2.1.233.test.ts` (com `VERSION = "2.1.233"` no material do hash) |
| Branches             | `feat/upstream-2.1.222-wave-N`                           | `feat/upstream-2.1.233-wave-N`                                                     |
| Subpath export       | `./profiles/claude-code-2.1.222`                         | `./profiles/claude-code-2.1.233`                                                   |

### 10.2 Diff verificado 222→233 — o que NÃO mudou (invariantes preservados)

Tudo abaixo foi enumerado independentemente nas duas versões e é **idêntico**. As seções 1.3 (D1, D4, D5) e as Fases 2.2, 3.1 e 3.3 permanecem válidas sem alteração de conteúdo — só de nome de versão.

1. **Registro de betas (D1/Fase 2.2): zero diff.** 31 entradas efetivas, mesma ordem load-bearing, mesmo slot `null` filtrado, mesmos 2 pseudo-betas de latch interno fora do registro (`x-cc-internal-mid-conv-cache-promotion[-ok]`), mesmos sets auxiliares. `summarize-connector-text-2026-03-13` ausente em ambas (confirma a remoção que o plano já registrava). A Fase 2.2 vale byte a byte para `2.1.233`.
2. **Fingerprint de billing (1.3.1/Fase 3.2): algoritmo e salt idênticos.** Salt `59cf53e54c78`, seed = chars 4/7/20 da primeira mensagem user não-meta (fallback `"0"`), `sha256(salt + chars + VERSION).slice(0,3)`. Único delta de saída é a string `VERSION` — o vetor conhecido deve ser computado com `"2.1.233"`.
3. **Resolução de `max_output_tokens` (D4/Fase 3.1): zero diff.** Catálogo `{default, upper}`, fallbacks legados, override remote-config `heather_vale` (fora de escopo por A1) e override `request.max_tokens >= 4096` — byte-equivalentes módulo renomeação de símbolos. `kelp_forest_sonnet` idem.
4. **Predicado 1M (D5/Fase 3.3): zero diff.** Mesmos flags `native_1m`/`supports_1m_beta`/`supports_1m_suffix` por modelo.
5. **Transporte (1.2): envelope do CLI idêntico.** `anthropic-version: 2023-06-01`; formato do User-Agent `claude-cli/${VERSION} (external, ...)` inalterado. `src/headers.ts` continua intocado.
6. **Catálogo de modelos (D2): mesmos 17 ids, mesma ordem, mesmos `context`/`max_output_tokens`/`pricing`/`provider_ids`/`advisor_rank`/`image_limits`/`capabilities` — exceto o campo novo da §10.3.2.**

### 10.3 Diff verificado 222→233 — o que mudou (emendas ao plano)

#### 10.3.1 D7 emendado — billing block ganha `cc_prompt_id` + hardening (afeta Fase 3.2 e R12)

O builder do bloco `x-anthropic-billing-header` passou de 3 para 5 parâmetros. Três mudanças:

1. **Novo segmento opcional `cc_prompt_id=<uuid>;`**, emitido **após** `cc_prev_req`, quando: valor definido **e** casa com `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` **e** first-party **e** gate interno de atribuição ativo. Template completo em `2.1.233` — 2 segmentos fixos + **5** opcionais, nesta ordem:
   `x-anthropic-billing-header: cc_version=<v>.<fp>; cc_entrypoint=<e>;[ cch=00000;][ cc_workload=<w>;][ cc_is_subagent=true;][ cc_prev_req=<r>;][ cc_prompt_id=<p>;]`
2. **`cc_prev_req` agora é regex-validado no próprio builder**: `/^req_[A-Za-z0-9_-]{1,36}$/` — requestId fora do formato é **silenciosamente omitido** (em `2.1.222` o builder fazia só truthy-check). Nuance registrada: a string desse regex já existe 2× no binário `2.1.222` em outros pontos (provável validação upstream na captura do requestId do histórico); as golden fixtures decidem se há diferença observável de comportamento.
3. **Novo parâmetro de opções com flag `ignoreEnvOptOut`** — permite ignorar o opt-out via `CLAUDE_CODE_ATTRIBUTION_HEADER` quando first-party, gate interno ativo e sem `ANTHROPIC_UNIX_SOCKET`. **Decisão (espelha A1):** fora de escopo — depende de estado de ambiente/processo que o pacote (puro, sem I/O) não modela. Documentar como divergência permanente no doc de análise, como feito com `heather_vale`.

**Emendas concretas à Fase 3.2:**

- `src/contracts.ts`: além de `previousRequestId?: string`, adicionar `promptId?: string`.
- `src/fingerprint.ts` (`createBillingBlock`): implementar os dois novos gates com os regexes **extraídos, não inferidos**; ordem dos segmentos conforme template acima.
- `test/system-prompt.test.ts` / fixtures: cobrir os casos — `promptId` UUID válido (emite), `promptId` malformado (omite silencioso), `previousRequestId` fora de `/^req_[A-Za-z0-9_-]{1,36}$/` (omite silencioso), ambos presentes (ordem `cc_prev_req` → `cc_prompt_id`).
- **R12 atualizado:** o template tem **5 segmentos opcionais, não 4**. O teste de composição deve asserir o template completo reextraído do binário `2.1.233`.

#### 10.3.2 D6 emendado — catálogo ganha `effort_cost_index` (afeta Fase 2.3)

Campo novo `effort_cost_index` (shape `{low, medium, high, xhigh, max}`, valores numéricos relativos a `high = 1`), inserido entre `default_effort` e `image_limits`, presente em exatamente 4 modelos:

| Modelo            | low  | medium | high | xhigh | max  |
| ----------------- | ---- | ------ | ---- | ----- | ---- |
| `claude-sonnet-5` | 0.47 | 0.74   | 1    | 2.41  | 5.59 |
| `claude-opus-4-8` | 0.72 | 0.90   | 1    | 1.65  | 1.88 |
| `claude-opus-5`   | 0.67 | 0.76   | 1    | 1.60  | 1.70 |
| `claude-fable-5`  | 0.60 | 0.77   | 1    | 1.74  | 1.91 |

- É a **única** mudança do catálogo estático 222→233 (string `effort_cost_index`: 0 ocorrências no 222, 7 no 233). Nenhuma capability nova; nenhum modelo adicionado/removido.
- **Emenda à Fase 2.3:** incluir `effort_cost_index?` no tipo do catálogo e nos 4 modelos acima. **Tarefa de verificação nova (T2.3.7):** confirmar durante a implementação se `effort_cost_index` alimenta alguma decisão wire-visible (ex.: seleção de effort) ou se é só dado de UI/advisor; registrar a conclusão no doc de análise. Até prova em contrário, tratar como dado inerte de catálogo.
- **Correção de registro em D6:** `fallback_chain` **não** é campo do catálogo estático (que usa `fallback_3p`, string única); `fallback_chain` (array) existe apenas no schema zod de override por remote-config — que, sendo remote-config, está fora de escopo (A1). O doc de análise da 2.1.233 deve refletir isso.

#### 10.3.3 Fatos novos de suporte (afetam 1.1, 1.3.1 e R6)

- **SDK Anthropic embutido: `0.94.0` → `0.112.1`** (anotar em 1.1). Não afeta o envelope do `/v1/messages`: UA do CLI e `anthropic-version` idênticos. As ~29 strings novas de header no binário (`anthropic-ratelimit-unified-{5h,7d,overage}-*`, `Anthropic-Worker-ID`, etc.) são do SDK embutido, de rotas novas (`/v1/deployments`, `/v1/dreams`) ou response-side/terceiros — nenhuma entra no request que este pacote constrói.
- **`sdk-tools.d.ts` (diff completo lido): só schemas de tools** (novos tools `ReadNotifications`/`ProposeGoal`, campos novos em `SendFeedback`/`RemoteTrigger`/`AgentOutput`/`BashOutput`). Zero impacto no envelope do request.
- **R6 eliminado para `2.1.233`:** metadados de build extraídos com sucesso e registrados aqui — `VERSION 2.1.233`, `BUILD_TIME 2026-08-14T17:21:48Z`, `GIT_SHA f8d57569aaf350fe25dc4dfa10cad59db8ea4d45` (para referência, `2.1.222`: `BUILD_TIME 2026-08-04T01:24:05Z`, `GIT_SHA fbf49312c28437bf9c2546b9ace3bd7b34eb6ff6`).
- **Ressalva de método (registrar no doc de análise):** a lógica de _seleção_ de betas (registro → header `anthropic-beta` do `/v1/messages`) não foi literal-diffada entre 222 e 233. Mitigação em camadas: registro idêntico, transporte idêntico, e as golden fixtures da Fase 2.4 capturam qualquer drift de seleção.

### 10.4 Riscos — estado após a reanálise

| Risco                                          | Estado                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R2 (fixtures circulares)                       | **Inalterado** — continua o risco crítico dominante da Wave 2                                                                                                                                                |
| R6 (metadados de build)                        | **Eliminado** para `2.1.233` (§10.3.3)                                                                                                                                                                       |
| R11 (troca de default cega canário)            | **Inalterado** — mitigação T2.3.5/T2.3.6 permanece                                                                                                                                                           |
| R12 (posição de segmentos do billing)          | **Agravado e re-especificado** — 5 segmentos opcionais, template completo na §10.3.1                                                                                                                         |
| Novo — R13: upstream avança durante a execução | Média/Médio — upstream publica ~1 versão/dia. Mitigação: congelar o alvo em `2.1.233` para este ciclo; novas versões entram no próximo ciclo via runbook da Wave 4. Não re-retarget-ear no meio da execução. |

### 10.5 O que este adendo NÃO muda

- Arquitetura alvo (§3), estrutura de waves/fases (§5), diretivas (§0), ambiguidades resolvidas A1/A2/A4/A5 e a pendência A3 — tudo permanece.
- A ordem de execução: Wave 0 → 1 → 2 → 3 → 4, com os mesmos gates.
- O profile `2.1.195` continua exportado e byte-exato; a troca de default (A2) agora aponta para `2.1.233`.
