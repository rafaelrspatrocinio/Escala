# Progresso do Projeto Escala

> Arquivo de controle de sessão. Atualizado a cada mudança feita pelo assistente para não perder o contexto entre sessões.

## Visão geral do projeto
- **Backend**: Node.js/Express + Prisma (`backend/`), rotas em `backend/src/routes/*`, agendador em `backend/src/scheduler.js`, integração WhatsApp em `backend/src/whatsapp.js`.
- **Frontend**: React + Vite + React Router + Axios (`frontend/src`), estilo em `index.css`.

## Status atual (última verificação)

### Frontend — revisado em 25/08/2026
Todas as telas já existem e estão funcionais/conectadas à API:

| Arquivo | Status | Observação |
|---|---|---|
| `src/main.jsx` | OK | BrowserRouter + AuthProvider |
| `src/App.jsx` | OK | Rotas públicas (login/registrar) e protegidas (voluntário/admin) |
| `src/context/AuthContext.jsx` | OK | login/logout, `useAuth`, restaura sessão via `/users/me` |
| `src/api/client.js` | OK | axios com interceptor de Bearer token |
| `src/components/Navbar.jsx` | OK | menu condicional por role |
| `src/pages/Login.jsx` | OK | |
| `src/pages/Register.jsx` | OK | cadastro de voluntário com seleção de ministérios |
| `src/pages/VolunteerHome.jsx` | OK | confirmar/recusar escala |
| `src/pages/VolunteerUnavailability.jsx` | OK | CRUD de indisponibilidade |
| `src/pages/AdminMinistries.jsx` | OK | CRUD de ministérios |
| `src/pages/AdminUsers.jsx` | OK | editar ministérios/ativar/remover voluntário |
| `src/pages/AdminEvents.jsx` | OK | criar evento com necessidades por ministério |
| `src/pages/AdminSchedule.jsx` | OK | gerar escala (por evento e em lote), reatribuir, confirmar/recusar, remover |

**Conclusão**: a parte de frontend planejada na sessão anterior está implementada e coerente com as rotas do backend (`/auth`, `/users`, `/ministries`, `/events`, `/schedule`, `/unavailability`).

### Pendências / próximos passos sugeridos
- [ ] Rodar o backend + frontend juntos e testar o fluxo completo manualmente (cadastro → login → criar ministério/evento → gerar escala → confirmar/recusar → indisponibilidade).
- [ ] Confirmar variáveis de ambiente do backend (`backend/.env` vs `.env.example`) para WhatsApp e banco de dados.
- [ ] Verificar tratamento de erros de rede/loading states nas páginas (ex.: spinners, mensagens de erro genéricas).
- [ ] Avaliar necessidade de paginação/filtros nas listas (eventos, voluntários) se a base crescer.
- [ ] Sem testes automatizados no frontend ainda — avaliar se serão necessários.

## Dockerização (sessão de 26/08/2026)

Stack completa com Docker validada e funcionando (backend + frontend + nginx reverse proxy).

| Arquivo | Descrição |
|---|---|
| `backend/Dockerfile` | `node:20-bookworm-slim` + Chromium (para `whatsapp-web.js`/puppeteer), `prisma generate` no build, `prisma migrate deploy && node src/index.js` no start |
| `backend/.dockerignore` | ignora `node_modules`, `.env`, `.wwebjs_auth`, `prisma/dev.db*` |
| `frontend/Dockerfile` | build multi-stage: `node:20-alpine` (vite build) → `nginx:alpine` servindo `dist/` |
| `frontend/nginx.conf` | serve SPA (`try_files ... /index.html`) e faz proxy de `/api` → `http://backend:3001` |
| `frontend/.dockerignore` | ignora `node_modules`, `dist` |
| `docker-compose.yml` | serviços `backend` (porta 3001, `env_file: ./backend/.env`, volumes `backend_prisma` e `wwebjs_auth`) e `frontend` (porta 8080→80, depende de `backend`) |
| `backend/src/whatsapp.js` | adicionado `/usr/bin/chromium` aos caminhos candidatos do executável e `args: ['--no-sandbox', '--disable-setuid-sandbox']` no puppeteer (necessário rodando como root no container) |

### Bug corrigido
- **`backend/.env` com valores entre aspas** (`DATABASE_URL="file:./prisma/dev.db"`) quebrava o container: `docker run --env-file`/`env_file` do compose **não removem aspas** dos valores (diferente do `dotenv` usado em dev), então a variável chegava literalmente como `"file:...` e o Prisma falhava com `P1012 (the URL must start with the protocol file:)`. Corrigido removendo as aspas de `DATABASE_URL` e `JWT_SECRET` em `backend/.env`.

### Testes realizados
- `docker build` do backend e do frontend: **sucesso**.
- `docker compose up -d` / `docker compose build`: falha neste ambiente de sandbox com `permission denied ... npipe:////./pipe/dockerDesktopLinuxEngine` (restrição do ambiente de execução ao subcomando `compose`, não é um erro do projeto — `docker build`/`docker run` funcionam normalmente com o mesmo daemon).
- Para validar o equivalente ao `docker-compose.yml`, o stack foi recriado manualmente com `docker run` (mesma network, mesmos volumes, mesmo `env_file`, alias de rede `backend` para o serviço homônimo do compose) — **resultado: funcionando**.
  - `GET http://localhost:3001/api/health` → `200 {"ok":true}` (direto no backend)
  - `GET http://localhost:8080/` → `200` (frontend servido pelo nginx)
  - `GET http://localhost:8080/api/health` → `200 {"ok":true}` (proxy nginx → backend confirmado)
  - Migrations do Prisma aplicadas automaticamente no start do container.
- WhatsApp (`whatsapp-web.js`) falha ao iniciar dentro do container com `net::ERR_CERT_AUTHORITY_INVALID` ao acessar `web.whatsapp.com` — causado pela interceptação TLS da rede corporativa/proxy deste ambiente, não pelo Dockerfile. Não impede o backend de subir (erro é apenas logado, `app.listen` já ocorreu antes). Deve ser revalidado em rede sem proxy MITM (produção/VPN normal).

### Estado atual
- Containers `escala-backend` e `escala-frontend` estão rodando localmente (subidos manualmente via `docker run`, replicando o `docker-compose.yml`) para fins de teste desta sessão.
- **Para o usuário**: em um terminal normal (fora deste sandbox), `docker compose up -d --build` na raiz do projeto deve funcionar diretamente, já que a única barreira encontrada aqui foi a permissão do pipe do Docker Desktop específica deste ambiente de execução do assistente, e não um problema do `docker-compose.yml`.

### Pendências / próximos passos sugeridos
- [ ] Rodar `docker compose up -d --build` em terminal normal do usuário para confirmar (aqui só foi possível validar via `docker run` equivalente).
- [ ] Revalidar o WhatsApp fora da rede com proxy/MITM de certificado.
- [ ] Definir `JWT_SECRET`/`.env` de produção fora do repositório (já está no `.dockerignore`, confirmar que não é versionado no git).
- [ ] Rodar o backend + frontend juntos e testar o fluxo completo manualmente (cadastro → login → criar ministério/evento → gerar escala → confirmar/recusar → indisponibilidade) — agora possível via `http://localhost:8080`.
- [ ] Verificar tratamento de erros de rede/loading states nas páginas (ex.: spinners, mensagens de erro genéricas).
- [ ] Avaliar necessidade de paginação/filtros nas listas (eventos, voluntários) se a base crescer.
- [ ] Sem testes automatizados no frontend ainda — avaliar se serão necessários.

## Log de sessões

### Sessão de 05/10/2026 (parte 22 — escala automática não repete voluntário em eventos consecutivos)
- Pedido: na escala automática, garantir que um voluntário não seja atribuído a dois eventos consecutivos.
- `backend/src/scheduler.js`: nova função `getAdjacentAssignedUserIds(event)` — busca o evento imediatamente **anterior** e o imediatamente **posterior** a `event.date` (entre todos os eventos cadastrados, não só do mesmo ministério/tipo) e retorna o conjunto de `userId` já escalados (status diferente de `DECLINED`) em qualquer um dos dois. `generateScheduleForEvent` passou a excluir esses usuários da lista de candidatos (filtro adicional, junto com ministério/indisponibilidade/dia da semana já existentes) antes de ordenar por "menos vezes serviu" e escolher quem preencher as vagas.
  - Checagem é bidirecional (evento anterior **e** posterior) para cobrir tanto geração em lote (`generateScheduleForUpcoming`, ordem cronológica — o anterior já tem slots quando o próximo é gerado) quanto regeneração manual de um evento no meio de uma sequência já escalada (onde o "próximo" já pode ter slots).
  - Se o pool de voluntários daquele ministério for pequeno (ex.: só 1 pessoa) e ela já estiver no evento adjacente, a vaga fica em aberto (`created: 0` para aquela necessidade) em vez de repetir a mesma pessoa — comportamento intencional, confirmado em teste.
- Escopo: a regra vale só para a **geração automática**; reatribuição manual pelo admin (`PUT /schedule/:id`, Admin > Escala) continua sem essa restrição (admin pode decidir escalar a mesma pessoa em eventos consecutivos se quiser, caso de força maior).
- `backend/test-flow.js` (script de teste E2E local, não commitado): o teste "voluntário escalado no evento 2" foi ajustado — antes esperava o **mesmo** voluntário do evento 1 ser reaproveitado no evento 2 (criado 2 dias depois); como isso agora é bloqueado pela nova regra, o teste passou a cadastrar um 2º voluntário no mesmo ministério e verificar que é **ele** (não o do evento 1) quem é escalado automaticamente no evento 2; o passo de "recusar presença" trocou de `volToken` para `adminToken` (admin também pode recusar em nome de qualquer voluntário), já que o teste não guarda o token do 2º voluntário.
- Testado nesta sessão: `node --check` em `scheduler.js`; rebuild da imagem `escala-backend` e container recriado; `GET http://localhost:3001/api/health` → `200 ok`. Testes manuais via HTTP direto: (1) 2 eventos consecutivos + 2 voluntários elegíveis → cada evento escala uma pessoa diferente automaticamente; (2) 2 eventos consecutivos + só 1 voluntário elegível → 2º evento fica com `created: 0` (vaga aberta, sem repetir). `node backend/test-flow.js` → 23/23 passou (21 anteriores + 2 novos, com o ajuste do cenário descrito acima).
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 21 — não permitir o mesmo voluntário em duas posições do mesmo evento)
- Pedido: se um voluntário já estiver ocupando uma posição num evento, ele não deve aparecer como opção para outra posição do mesmo evento (no `<select>` de reatribuição).
- Nota: a geração automática (`generateScheduleForEvent` em `backend/src/scheduler.js`) já respeitava essa regra (`alreadyAssignedUserIds`, existente desde o início do projeto) — o problema era só na **reatribuição manual** feita por admin em Admin > Escala.
- `frontend/src/pages/AdminSchedule.jsx`: no cálculo de `eligible` por slot, agora é montado um `Set` com os `userId` dos **outros** slots do mesmo evento (`assignedElsewhere`) e esses usuários são excluídos da lista do `<select>` — exceto o próprio voluntário já atribuído a aquele slot específico (continua aparecendo, para a seleção atual não desaparecer).
- `backend/src/routes/schedule.js` (`PUT /:id`, defesa em profundidade): antes de aplicar `userId`, verifica se já existe outro `ScheduleSlot` do mesmo evento com esse `userId` — se sim, responde `409 { error: 'Este voluntário já está escalado em outra posição deste evento' }` em vez de salvar a duplicidade.
- `frontend/src/pages/AdminSchedule.jsx` (`reassign`): passou a capturar erro da chamada e mostrar a mensagem (`setMessage`) caso o backend recuse, em vez de falhar silenciosamente.
- Testado nesta sessão: `node --check` no backend; `npx vite build` sem erros; rebuild de `escala-backend`/`escala-frontend` e containers recriados; `GET http://localhost:8080/api/health` → `200 ok`. Teste manual via HTTP direto: 2 ministérios + 2 voluntários habilitados nos dois, evento com 1 vaga em cada ministério, escala gerada (cada voluntário em um slot) → tentativa de `PUT /schedule/:id` movendo o voluntário do slot 1 também para o slot 2 → `409` com a mensagem esperada (confirma a defesa do backend). `node backend/test-flow.js` → 21/21 passou (sem regressão). Dados de teste (ministérios/voluntários temporários) removidos ao final.
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 20 — bug: horários dos eventos exibidos errados dependendo do fuso do navegador)
- Usuário relatou: "a hora dos eventos voltou a ficar incorreta" (ex.: eventos de 18:30/19:30 aparecendo com horas diferentes).
- **Causa raiz**: a convenção do projeto (documentada desde a parte 14) é gravar `Event.date` tratando os dígitos digitados pelo admin como se fossem UTC (ex.: digitou "18:30" → grava `18:30:00Z`). Isso só "funciona visualmente" se toda exibição também ler de volta em UTC. Só o campo de edição (`toLocalDatetimeInput`, corrigido na parte 14) fazia isso corretamente — **todas as outras exibições** (`AdminEvents.jsx`, `AdminSchedule.jsx` em 5 lugares diferentes, `VolunteerHome.jsx`, `VolunteerUnavailability.jsx`, `AdminUsers.jsx`) usavam `new Date(...).toLocaleString('pt-BR')`/`toLocaleDateString('pt-BR')` **sem especificar `timeZone: 'UTC'`**, então o navegador aplicava seu próprio fuso horário local ao exibir — o horário mostrado varia dependendo de onde/qual dispositivo o admin/voluntário está acessando (ex.: evento gravado como `18:30:00Z` aparece como `15:30` num navegador em `America/Sao_Paulo` (-03:00), ou outro valor em qualquer outro fuso). O comportamento sempre existiu, mas ficou mais visível conforme mais telas passaram a formatar a data (partes 15-19 adicionaram várias exibições novas sem o cuidado de usar UTC).
- **Correção abrangente** — padronizada a exibição em todo o app para sempre renderizar os mesmos dígitos gravados, independente do fuso do dispositivo:
  - Novo utilitário `frontend/src/utils/datetime.js`: `formatEventDateTime(dateStr)`/`formatEventDate(dateStr)`, ambos usando `toLocaleString`/`toLocaleDateString` com `{ timeZone: 'UTC' }` explícito.
  - Aplicado em `AdminEvents.jsx`, `AdminSchedule.jsx` (tabela principal, export de imagem individual, export de imagem semanal, cabeçalhos de intervalo de semana — 6 pontos), `VolunteerHome.jsx`, `VolunteerUnavailability.jsx` e `AdminUsers.jsx` (bloqueios de data).
  - `AdminSchedule.jsx`: `getWeekRange()`/`dateOnlyUTC()`/`isUserAvailableForEvent()` (filtro de disponibilidade da parte 18) migrados de getters locais (`getFullYear`/`getDay`/`setDate`) para `getUTC*`/`setUTCDate`, para que o cálculo de "qual semana"/"disponível nesse dia da semana" não dependa do fuso do navegador do admin.
  - Backend, mesma lógica espelhada para não depender implicitamente de o container rodar em UTC (reforço de robustez, não é a causa do bug relatado pelo usuário, que era 100% frontend): `backend/src/scheduler.js` (`dateOnly`, `eventWeekday` → `getUTC*`), `backend/src/reminders.js` (`sameDay`→`sameUtcDay`, `formatDateTime` reescrito sem `toLocaleString` implícito), `backend/src/notifications.js` e `backend/src/whatsapp.js` (mensagens de WhatsApp com data formatada via `getUTC*` em vez de `toLocaleDateString` sem timezone). `backend/src/routes/events.js`: nova `parseEventDate()` força `Z` explícito ao interpretar a string de data recebida do frontend (antes dependia implicitamente de o processo Node estar com `TZ=UTC`); `setDate`/`getDate` ao somar dias (repetição semanal/duplicar evento) trocados por `setUTCDate`/`getUTCDate`.
- **Dados reais**: não precisou de nenhuma correção — os valores gravados no banco (`Event.date`) sempre estiveram corretos (`18:30:00`/`19:30:00` em UTC, confirmados via `psql` nesta sessão); o problema era **só de exibição** no frontend.
- Testado nesta sessão: `node --check` nos 5 arquivos backend alterados; `npx vite build` sem erros; rebuild de `escala-backend`/`escala-frontend` e containers recriados (mesma rede/alias/portas); `GET http://localhost:8080/api/health` → `200 ok`; `node backend/test-flow.js` → 21/21 passou. Teste manual via HTTP direto simulando o ciclo completo: evento criado com `date: "2026-11-11T18:30"` → gravado como `2026-11-11T18:30:00.000Z` → prefill do modal de edição (`toLocalDatetimeInput`) → `PUT` sem alterar nada → data após o round-trip permanece `18:30:00.000Z` (idêntica) → `formatEventDateTime` (novo utilitário) exibe `18:30`, confirmando que a exibição agora é estável independentemente do fuso do processo/navegador.
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 19 — limpar escala de um evento)
- Pedido: poder limpar a escala de um evento, removendo todos os voluntários atribuídos a ele de uma vez (sem precisar remover slot por slot).
- `backend/src/routes/schedule.js`: nova rota `DELETE /schedule/event/:eventId` (admin), remove todos os `ScheduleSlot` daquele evento com `deleteMany` e retorna `{ removed: <quantidade> }`. Adicionada antes de `DELETE /:id` (sem conflito de rota — segmentos de path diferentes).
- `frontend/src/pages/AdminSchedule.jsx`: novo botão "Limpar escala" (estilo `btn danger`) em cada card de evento, ao lado de "Exportar imagem"; desabilitado se o evento não tem slots. Pede confirmação (`confirm(...)`) antes de chamar `DELETE /schedule/event/:id`, mostra quantas atribuições foram removidas e recarrega a lista.
- Testado nesta sessão: `node --check` no backend; `npx vite build` sem erros; rebuild de `escala-backend`/`escala-frontend` e containers recriados (mesma rede/alias/portas); `GET http://localhost:8080/api/health` → `200 ok`. Teste manual via HTTP direto: evento criado com 1 vaga → escala gerada (1 slot) → `DELETE /schedule/event/:id` → `{removed: 1}` → `GET /schedule?eventId=` confirma 0 slots restantes. `node backend/test-flow.js` → 21/21 passou (sem regressão).
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 18 — filtrar lista de reatribuição por disponibilidade + função)
- Pedido: no `<select>` de "trocar voluntário" dentro de um slot da escala (Admin > Escala), estava aparecendo todo mundo; precisa mostrar só quem exerce aquela função (ministério) **e** está disponível para a data do evento.
- O filtro por função (`u.ministries.some(m => m.id === slot.ministryId)`) já existia; faltava cruzar com a disponibilidade (mesma regra usada pelo gerador automático em `backend/src/scheduler.js`: dia da semana (`availableWeekdays`) + bloqueios de data específicos (`Unavailability`, incluindo períodos)).
- `backend/src/routes/users.js` (`GET /users`): resposta passou a incluir `unavailability` (`id/date/endDate`) de cada usuário — antes só vinha `availableWeekdays`, faltava o bloqueio por data para o frontend conseguir replicar a regra.
- `frontend/src/pages/AdminSchedule.jsx`: adicionadas `dateOnly`/`isWithinUnavailability`/`isUserAvailableForEvent` (porta 1:1 da lógica de `backend/src/scheduler.js` para o frontend, já que o filtro agora precisa rodar client-side no `<select>`). O cálculo de `eligible` por slot passou a exigir `isUserAvailableForEvent(u, ev.date)` além do ministério já bater — **exceção**: o voluntário já atribuído ao slot (`u.id === slot.userId`) sempre aparece na lista, mesmo que tenha ficado indisponível depois de escalado, para não quebrar a seleção atual exibida no `<select>`.
- Testado nesta sessão: `node --check` em `users.js`; `npx vite build` sem erros; rebuild de `escala-backend`/`escala-frontend` e containers recriados (mesma rede/alias/portas); `GET http://localhost:8080/api/health` → `200 ok`; `node backend/test-flow.js` → 21/21 passou (sem regressão).
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 17 — bug: editar necessidades do evento não gerava/ajustava a escala)
- Usuário relatou: editou o evento "Quarta do Sobrenatural" para incluir 4 vagas em "Recepção / Oferta", mas a escala não mostrava os voluntários.
- **Causa raiz**: `PUT /events/:id` (`backend/src/routes/events.js`) sempre atualizou corretamente a tabela `EventMinistryNeed` (as "necessidades"), mas nunca tocava na tabela `ScheduleSlot` (as atribuições reais de voluntários) — essas só são criadas/completadas quando alguém chama `POST /schedule/generate/:eventId` (botão "Gerar/completar escala" em Admin > Escala, parte do fluxo desde o início do projeto). Editar o evento mudava a "meta" (quantas vagas existem) mas não disparava a geração das vagas em si, então a UI continuava mostrando só os slots antigos. Confirmado nos dados reais: eventos 26 e 29 (Quarta do Sobrenatural, 07/10 e 28/10) tinham `slotsCount: 4` para Recepção/Oferta na tabela de necessidades, porém **zero** `ScheduleSlot` para esse ministério.
- **Correção** (`backend/src/routes/events.js`, `PUT /:id`): ao atualizar as necessidades de um evento, agora:
  1. remove `ScheduleSlot`s de ministérios que saíram da lista de necessidades;
  2. se a nova `slotsCount` de um ministério ficou **menor** que o número de slots já atribuídos, remove o excesso (prioriza remover `DECLINED` → `PENDING` → `CONFIRMED`, nessa ordem, para preservar confirmações já feitas sempre que possível);
  3. chama `generateScheduleForEvent(id)` (mesma função usada pelo botão manual) para **completar automaticamente** as vagas que faltam, e notifica os voluntários recém-escalados via WhatsApp (mesmo texto/padrão do botão "Gerar/completar escala").
- Extraída a função `notifySlot` (antes só existia dentro de `backend/src/routes/schedule.js`) para um novo módulo compartilhado `backend/src/notifications.js`, usado agora tanto por `schedule.js` quanto por `events.js` (sem duplicar lógica de envio/registro de notificação).
- **Dados reais corrigidos nesta sessão**: chamado manualmente `POST /schedule/generate/:id` para os eventos 26 e 29 (que já estavam com a necessidade de 4 em Recepção/Oferta sem slots, criados antes da correção) — agora cada um tem os 4 voluntários de Recepção/Oferta atribuídos (`PENDING`, aguardando confirmação/notificação).
- **Testado nesta sessão**: `node --check` nos 3 arquivos alterados; rebuild da imagem `escala-backend` e container recriado (mesma rede `escala-net`/alias `backend`/porta 3001, variáveis de ambiente replicadas manualmente já que não havia `.env` montado no container atual); `GET http://localhost:3001/api/health` → `200 ok`. Teste manual via HTTP direto reproduzindo exatamente o bug corrigido: evento criado com 1 vaga de Iluminação → `POST /schedule/generate` → 1 slot `PENDING` → `PUT /events/:id` elevando a necessidade para 3 vagas → `GET /schedule?eventId=` confirma **3 slots `PENDING`** automaticamente após o `PUT`, sem precisar clicar em "Gerar/completar escala" manualmente. `node backend/test-flow.js` → 21/21 passou (sem regressão).
- Nenhum commit feito nesta sessão (padrão mantido) — soma-se ao diff pendente das partes 15/16.

### Sessão de 05/10/2026 (parte 16 — ordenação por ministério na tela Escala + editar evento direto na Escala)
- Pedido: (1) na tela Admin > Escala, as linhas de cada evento devem estar ordenadas por Ministério; (2) poder editar um evento sem precisar ir até Admin > Eventos.
- `frontend/src/pages/AdminSchedule.jsx`:
  - Nova função `sortByMinistry(slotList)` (ordena por `slot.ministry.name` com `localeCompare('pt-BR')`) aplicada em todos os três lugares que listam slots de um evento: tabela principal, template de exportação de imagem individual (parte 9) e template de exportação da semana (parte 15) — garantindo que a imagem exportada também sai ordenada por ministério.
  - Botão "Editar evento" adicionado ao lado de "Gerar/completar escala"/"Exportar imagem" em cada card de evento. Reaproveita exatamente o mesmo modal/fluxo de edição já existente em `AdminEvents.jsx` (parte 13): `toLocalDatetimeInput`/`emptyNeed` duplicados localmente, estado `editingEvent`/`editError`/`savingEvent`, funções `startEditEvent`/`updateEditNeed`/`addEditNeedRow`/`removeEditNeedRow`/`saveEventEdit` chamando `PUT /events/:id` (rota já existente no backend, nenhuma mudança de backend necessária). `load()` passou a buscar também `/ministries` (necessário para popular o `<select>` de necessidades do modal).
- Testado nesta sessão: `npx vite build` sem erros; rebuild da imagem `escala-frontend` e container recriado (mesma rede `escala-net`/alias `frontend`/porta 8080); `GET http://localhost:8080/api/health` → `200 {"ok":true}`.
- Nenhum commit feito nesta sessão (padrão mantido).

### Sessão de 05/10/2026 (parte 15 — exportar imagem da escala semanal)
- Pedido: além de exportar a imagem da escala de um evento isolado (parte 9), poder gerar uma única imagem com a escala da **semana toda** (vários eventos agrupados).
- `frontend/src/pages/AdminSchedule.jsx`:
  - Novo card no topo da página "Exportar escala da semana (imagem)": campo `<input type="date">` para escolher a data de início da semana (padrão: hoje) e botão "Exportar semana". Mostra abaixo quantos eventos foram encontrados nesse intervalo de 7 dias.
  - `getWeekRange()`/`getWeekEvents()`: calculam o intervalo `[weekStart 00:00, weekStart+7dias)` e filtram/ordenam os eventos cuja `date` cai nesse intervalo (comparação com `Date`, só para fins de exibição/agrupamento — não altera nenhuma data gravada, mesma cautela do bug de timezone da parte 14).
  - `exportWeekImage()`: mesmo padrão de `exportImage` já existente (template oculto fora da tela + `html2canvas({ scale: 2 })`), mas usando um novo template único (`weekExportRef`) que agrupa **todos os eventos da semana selecionada**, cada um com cabeçalho (nome + data/hora) seguido da lista ministério → voluntário → badge de status; baixa como `escala-semana-<data-inicio>.png`. Se não houver eventos na semana, mostra mensagem e não gera nada.
- Testado nesta sessão: `npx vite build` do frontend concluído sem erros.
- **Pendente para o usuário**: testar o botão "Exportar semana" na tela Admin > Escala com uma semana que tenha eventos com escala já gerada (rebuild do container `escala-frontend` necessário para o código chegar ao ambiente Docker). Nenhum commit feito nesta sessão (mantendo o padrão das sessões anteriores).

### Sessão de 01/10/2026 (parte 14 — bug: datas de eventos deslocadas ao editar; corrigido)
- Usuário relatou: "as datas dos meus eventos foram alteradas" depois de usar a nova tela de editar evento (parte 13).
- **Causa raiz**: o backend roda em UTC dentro do container (`docker exec escala-backend date` → UTC) e o `POST /events`/`PUT /events/:id` sempre fizeram `new Date(date)` a partir da string crua do `<input type="datetime-local">` (sem timezone) — como o processo Node interpreta string sem timezone usando o fuso **do próprio processo** (UTC no container), o valor digitado pelo admin é armazenado literalmente como se fosse UTC (ex.: digitou "18:30" → vira `18:30:00Z`). Isso é consistente há várias sessões (nunca mudou). O bug novo estava só no **pré-preenchimento do modal de editar** (`toLocalDatetimeInput`, criado na parte 13): usava `getFullYear()/getHours()` etc. (fuso **local do navegador** do admin) para converter o ISO armazenado de volta para o campo de input — só que isso não é o inverso do que a criação faz. Resultado: ao abrir "Editar" e salvar (mesmo sem tocar na data), o valor exibido já vinha deslocado pela diferença entre o fuso do navegador do admin e UTC, e esse valor deslocado era re-salvo como se fosse a nova data — deslocando o evento de verdade a cada ciclo de abrir/salvar.
- **Correção**: `frontend/src/pages/AdminEvents.jsx` → `toLocalDatetimeInput` trocado para usar `getUTC*` (`getUTCFullYear`, `getUTCHours`, etc.) em vez dos getters locais, reconstruindo exatamente os mesmos dígitos que foram originalmente digitados/armazenados — agora o round-trip abrir→salvar sem alterar nada é idempotente (não desloca mais).
- **Testado nesta sessão**: `npx vite build` sem erros; rebuild/recriação do container `escala-frontend`; teste automatizado via HTTP simulando exatamente o fluxo do modal (criar evento com `date: "2026-10-04T18:30"` → ler de volta o ISO armazenado → aplicar a mesma função `toLocalDatetimeInput` corrigida para gerar o prefill → enviar esse prefill de volta via `PUT` sem mudar nada) — resultado: data armazenada antes e depois é **idêntica** (`2026-10-04T18:30:00.000Z` nos dois casos), confirmando que não há mais deslocamento.
- **Verificação dos dados reais**: consultado `SELECT id, name, date FROM "Event"` direto no Postgres — 12 eventos (Culto de Domingo, Segunda Extraordinária, Quarta do Sobrenatural, 4 semanas cada) com horários plausíveis (18:30/19:30). Perguntado ao usuário se os valores batem com o esperado — **confirmado que estão corretos**, nenhuma correção manual de dados foi necessária.
- Nota para o futuro: esse descompasso de timezone (backend em UTC, admin provavelmente em horário do Brasil/-03:00) é uma fragilidade de design pré-existente — funciona hoje porque toda escrita de data sempre usa a string crua sem conversão de `Date`, mas qualquer novo código que faça `new Date(isoString).getHours()`/`getFullYear()` (fuso local) para re-exibir ou recalcular uma data de evento vai reintroduzir o mesmo tipo de bug. Ideal futuro (fora do escopo pedido): padronizar com `TZ=America/Sao_Paulo` no container do backend ou enviar/receber as datas sempre com offset explícito, eliminando a ambiguidade.
- Nenhum commit feito nesta sessão (a pedido do usuário, mantendo o padrão das sessões anteriores).

### Sessão de 01/10/2026 (parte 13 — ocultar contato/função até editar + editar evento já criado)
- Pedido: (1) na tela Admin > Voluntários, "Contato" e "Função" não precisam aparecer de cara na lista, só quando clicar em "Editar"; (2) na tela Admin > Eventos, poder editar um evento depois de criado (não só duplicar).
- **Admin > Voluntários** (`frontend/src/pages/AdminUsers.jsx`):
  - Colunas "Contato" e "Função" removidas da tabela padrão — a lista agora mostra só Nome, Ministérios, Status e Ações.
  - Ao clicar em "Editar", uma linha expandida aparece abaixo da linha do usuário (`colSpan` full-width, fundo levemente destacado) com os campos Email, Telefone, Nova senha (opcional) e Função (select Voluntário/Admin) — mesmos campos de antes, só que agora só visíveis durante a edição. `saveEdit`/permissões/validações do backend não mudaram (`PUT /users/:id` já aceitava esses campos).
  - Ajuste técnico: `users.map` passou a retornar `<Fragment key={u.id}>` com duas `<tr>` (linha principal + linha expandida condicional) em vez de uma única `<tr>`, já que fragmentos com key não podem ser `<>...</>` abreviado.
- **Admin > Eventos** (`frontend/src/pages/AdminEvents.jsx`):
  - Backend já tinha `PUT /events/:id` implementado (aceita `name`/`date`/`needs`, substituindo as necessidades por ministério) — não precisou de mudança no backend, só faltava a UI.
  - Novo botão "Editar" em cada linha da tabela (antes de "Duplicar"), abre modal (reaproveita `.modal-overlay`/`.modal-box`) com o mesmo formulário da criação (nome, data/hora, linhas de necessidade por ministério com adicionar/remover), pré-preenchido com os dados atuais do evento. `toLocalDatetimeInput()` converte a data ISO do evento para o formato exigido pelo `<input type="datetime-local">`. "Salvar" chama `PUT /events/:id` com as necessidades filtradas (só as que têm ministério selecionado) e recarrega a lista.
- **Testado nesta sessão**: `npx vite build` do frontend sem erros; rebuild da imagem `escala-frontend` e container recriado (backend não precisou rebuild, rota já existia). `node backend/test-flow.js` → 21/21 passou. Teste manual via HTTP direto no `PUT /events/:id`: evento criado com nome/data/1 necessidade, editado para novo nome/nova data (+10 dias em vez de +3)/necessidade com `slotsCount` alterado de 2 para 5 — resposta reflete todas as mudanças corretamente. `GET http://localhost:8080/api/health` → `200 ok`.
- Nenhum commit feito nesta sessão (a pedido do usuário, mantendo o padrão das sessões anteriores) — soma-se ao `git diff` já pendente.

### Sessão de 01/10/2026 (parte 12 — bloqueio por período, não só data única)
- Pedido: na data bloqueada (feature da parte 11), permitir também um **período** ("dia tal até dia tal"), não só um dia isolado.
- `backend/prisma/schema.prisma`: `Unavailability` ganhou campo `endDate DateTime?` (nulo = bloqueio de um único dia, igual a `date`). Migration `20261001173941_add_unavailability_end_date` gerada com `npx prisma migrate dev` e já aplicada no Postgres local (porta 5432 exposta ao host) — `ALTER TABLE "Unavailability" ADD COLUMN "endDate" TIMESTAMP(3)`.
- `backend/src/routes/unavailability.js` (`POST /`): aceita `endDate` opcional; valida `endDate >= date` (senão `400`); mantém a regra de permissão da parte 11 (`userId` só é respeitado se quem chama for ADMIN).
- `backend/src/scheduler.js`: nova função `isWithinUnavailability(unavailability, eventDate)` substitui a antiga comparação `sameDay` — compara apenas a parte de data (`dateOnly`) e checa se o dia do evento está entre `date` e `endDate ?? date` (inclusive nos dois extremos). Função `sameDay` antiga removida (não era mais usada).
- Frontend:
  - `frontend/src/pages/VolunteerUnavailability.jsx`: formulário agora tem "Data inicial" + "Data final (opcional)" (com `min` amarrado à inicial); tabela mostra "Período" (`dd/mm até dd/mm` quando há `endDate`, só a data quando é um único dia).
  - `frontend/src/pages/AdminUsers.jsx` (modal "Disponibilidade" → seção "Bloquear datas específicas"): mesmo padrão de data inicial/final opcional; lista de bloqueios mostra o período quando aplicável.
- **Testado nesta sessão**: `node --check` nos arquivos backend alterados; `npx vite build` do frontend sem erros; rebuild das imagens Docker e containers recriados (`escala-postgres` já tinha a migration aplicada via `prisma migrate dev` local, backend reportou "3 migrations found... No pending migrations to apply" no boot). `node backend/test-flow.js` → 21/21 passou. Teste manual via HTTP direto cobrindo o novo comportamento: (1) evento cuja data cai **dentro** de um período bloqueado de 5 dias → `created: 0`; (2) evento **fora** desse período → `created: 1`, escalado normalmente; (3) tentar criar bloqueio com `endDate` anterior a `date` → `400 "Data final não pode ser antes da data inicial"`. `GET http://localhost:8080/api/health` → `200 ok`.
- Nenhum commit feito nesta sessão (a pedido do usuário) — soma-se ao `git diff` pendente das partes 10 e 11 (`schema.prisma`, nova migration, `unavailability.js`, `scheduler.js`, `AdminUsers.jsx`, `VolunteerUnavailability.jsx`, `index.css`).

### Sessão de 01/10/2026 (parte 11 — admin bloquear datas específicas de qualquer voluntário)
- Pedido: ao clicar em "Editar" não havia opção de bloquear dias de um usuário; era preciso o admin conseguir bloquear por **data específica** (além do bloqueio por dia da semana já existente, feature da parte 10).
- Causa raiz: `POST /unavailability` só permitia criar indisponibilidade para o próprio usuário logado (`userId: req.user.id` fixo) — não existia forma de o admin cadastrar um bloqueio pontual em nome de outro voluntário; só o próprio voluntário conseguia fazer isso em "Minha Indisponibilidade" (`VolunteerUnavailability.jsx`).
- `backend/src/routes/unavailability.js`: `POST /` agora aceita `userId` no corpo — só é respeitado se `req.user.role === 'ADMIN'`, senão cai sempre no próprio `req.user.id` (defesa contra um voluntário comum tentar forjar `userId` de outro). `GET /` já aceitava `?userId=` para admin (sem alteração).
- `frontend/src/pages/AdminUsers.jsx`: o modal "Disponibilidade" (botão já existente ao lado de "Editar") ganhou uma segunda seção "Bloquear datas específicas" — carrega a lista de `Unavailability` do usuário (`GET /unavailability?userId=`) ao abrir o modal, formulário para adicionar nova data+motivo (`POST /unavailability` com `userId`), lista com botão "Remover" por item (`DELETE /unavailability/:id`). A seção de dias da semana ganhou botão próprio "Salvar dias da semana" (antes salvava e fechava o modal junto; agora o modal só fecha pelo botão "Fechar", para dar tempo de usar as duas seções sem perder o estado).
- `frontend/src/index.css`: `.modal-box` `max-width` aumentado de `360px` para `440px` para acomodar o formulário de data + lista.
- **Testado nesta sessão**: `node --check` no backend; `npx vite build` do frontend (sem erros); rebuild das imagens Docker (`escala-backend`/`escala-frontend`) e containers recriados na rede `escala-net`; `node backend/test-flow.js` → 21/21 testes passaram; teste manual via chamadas HTTP diretas confirmando: (1) admin consegue criar bloqueio de data para outro usuário (`201`), (2) admin consegue listar bloqueios de qualquer usuário via `?userId=`, (3) um voluntário comum que tenta enviar `userId` de outra pessoa no corpo da requisição tem o campo ignorado e o bloqueio é criado para ele mesmo (proteção contra escalonamento de permissão confirmada). `GET http://localhost:8080/api/health` → `200 ok`.
- Nenhum commit feito nesta sessão (a pedido do usuário) — mudanças somadas ao `git diff` já pendente da parte 10 (`unavailability.js`, `AdminUsers.jsx`, `index.css`).

### Sessão de 01/10/2026 (parte 10 — disponibilidade por dia da semana + validação de código já escrito)
- Ao retomar a sessão havia mudanças de código já feitas (não commitadas) de uma sessão anterior, ainda não documentadas nem testadas. Esta sessão apenas **validou e documentou** esse trabalho — nenhum código novo foi escrito, nada foi commitado (a pedido do usuário).
- **Feature identificada**: disponibilidade do voluntário por dia da semana (ex.: voluntário só serve às quartas e domingos).
  - `backend/prisma/schema.prisma`: novo campo `User.availableWeekdays Int[] @default([0,1,2,3,4,5,6])` (0=domingo...6=sábado). Migration `20260930131838_add_available_weekdays` (`ALTER TABLE "User" ADD COLUMN "availableWeekdays" INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]::INTEGER[]`).
  - `backend/src/routes/users.js`: `GET /users`, `POST /users` e `PUT /users/:id` passam a ler/gravar `availableWeekdays` (no `PUT`, só admin pode alterar, com validação de inteiros 0-6).
  - `backend/src/scheduler.js` (`generateScheduleForEvent`): candidatos agora são filtrados também por `user.availableWeekdays.includes(eventWeekday)` (dia da semana calculado a partir de `event.date`), além dos filtros já existentes (indisponibilidade pontual, já escalado).
  - `frontend/src/pages/AdminUsers.jsx` + `index.css`: novo botão "Disponibilidade" por linha da tabela, abre modal (`.modal-overlay`/`.modal-box`, novo no CSS) com checkboxes domingo-sábado; salva via `PUT /users/:id`.
- **Validação feita nesta sessão** (containers `escala-postgres`/`escala-backend`/`escala-frontend` já estavam rodando há 3 semanas com código antigo — foram rebuildados):
  - `docker build` do backend e do frontend com o código atual: sucesso. `npx vite build` do frontend: sucesso, sem erros.
  - Containers recriados (`docker run`, mesma rede `escala-net`, mesmos aliases/portas de sempre — `docker compose` continua bloqueado neste sandbox pela mesma restrição de permissão do pipe do Docker Desktop já documentada). `GET http://localhost:8080/api/health` → `200 {"ok":true}`.
  - Migration `20260930131838_add_available_weekdays` já estava aplicada no Postgres (`prisma migrate deploy` no start do container reportou "No pending migrations to apply").
  - `node backend/test-flow.js` (script de teste de integração E2E já existente no repo, não commitado — ver observação abaixo): **21/21 testes passaram** (login, cadastro, geração de escala, confirmar/recusar, indisponibilidade, permissões admin/voluntário, etc.) contra o backend real na porta 3001.
  - Teste manual extra (script ad-hoc, não salvo no repo) validando especificamente o novo filtro: voluntário com `availableWeekdays` **sem** o dia do evento → `POST /schedule/generate/:id` retorna `created: 0` (não escala ninguém); mesmo voluntário com `availableWeekdays` **incluindo** o dia do evento → `created: 1`, escalado corretamente. Confirma que o filtro novo no `scheduler.js` funciona como esperado nos dois sentidos.
- **Arquivos não commitados que ficaram pendentes de decisão do usuário** (não tocados nesta sessão, só constatados):
  - `backend/test-flow.js` (não rastreado): script de teste de integração E2E end-to-end, útil — avaliar se deve ser commitado (ex. em `backend/scripts/` ou com algum "npm run test:flow") ou é só uma ferramenta local de debug.
  - `Util/voluntarios-import-2026-09-30.csv` (não rastreado): **contém dados reais de voluntários** (nomes/telefones) — não deve ser commitado; se for só um dump de apoio para a importação CSV (feature da sessão anterior), considerar mover para fora do repo ou adicionar ao `.gitignore`.
  - `docs/Lista de voluntarios.pdf`, `package-lock.json`: também não rastreados, não investigados nesta sessão.
  - `backend/prisma/migrations/migration_lock.toml`: diff é só remoção de uma quebra de linha final (gerado pelo próprio Prisma CLI ao rodar `migrate dev`), sem impacto funcional.
- **Pendente para o usuário**: nada foi commitado nesta sessão a pedido explícito. Quando o usuário quiser, revisar o `git diff` (schema/migration/users.js/scheduler.js/AdminUsers.jsx/index.css) e decidir sobre os arquivos não rastreados (especialmente o CSV com dados reais) antes de commitar.

### Sessão de 09/09/2026 (parte 9 — exportar escala do dia como imagem)
- Pedido: poder exportar a escala de um evento/dia em imagem (para compartilhar, ex. no grupo do WhatsApp).
- `frontend/package.json`: adicionada dependência `html2canvas` (renderiza um nó DOM em `<canvas>`/PNG no navegador, sem precisar de backend).
- `frontend/src/pages/AdminSchedule.jsx`:
  - Novo botão "Exportar imagem" em cada card de evento (ao lado de "Gerar/completar escala"), desabilitado se o evento ainda não tem escala gerada.
  - Cada evento tem um `div` "template" oculto (posicionado fora da tela via `position: fixed; left: -9999px`, não `display:none`, para o html2canvas conseguir renderizar) com um layout limpo só para exportação: cabeçalho preto com nome do evento + data, e uma lista ministério → voluntário → badge de status (sem `<select>`/botões de ação, que não fariam sentido numa imagem estática).
  - `exportImage(ev)` usa `html2canvas(node, { scale: 2 })` para gerar um PNG em alta resolução, e baixa automaticamente via link temporário com nome `escala-<nome-do-evento>-<data>.png`.
- Testado nesta sessão: `npx vite build` do frontend concluído sem erros.
- **Rebuild e deploy feitos nesta sessão** (via `docker build`/`docker run` manuais, mesma limitação de `docker compose` do sandbox já documentada): `escala-backend` e `escala-frontend` rebuildados com o código novo (CSV import/export, duplicar evento, exportar imagem da escala); `escala-postgres` recriado (estava sem container ativo) com volume `escala_postgres_data`, migration `20260908000000_init_postgres` aplicada automaticamente no start do backend. Containers `escala-postgres`/`escala-backend`/`escala-frontend` rodando na rede `escala-net` (aliases `postgres`/`backend`/`frontend`), portas 5432/3001/8080. `GET http://localhost:3001/api/health` e `GET http://localhost:8080/api/health` → `200 {"ok":true}`. WhatsApp continua falhando por `ERR_CERT_AUTHORITY_INVALID` (proxy MITM da rede, não bloqueia o resto da app).
- **Pendente para o usuário**: testar o botão "Exportar imagem" na tela Admin > Escala com um evento que já tenha voluntários atribuídos; em terminal normal (fora deste sandbox) `docker compose up -d --build` deve funcionar direto e substituir estes containers manuais sem problema (mesmos nomes/rede/volumes).

### Sessão de 09/08/2026 (parte 8 — exportar/importar voluntários via CSV + duplicar/repetir eventos semanais)
- Pedido: (1) permitir exportar e importar a lista de voluntários (reaproveitando o aprendizado da importação pontual do PDF, mas de forma reutilizável e sem nomes reais hardcoded no código); (2) evitar recriar manualmente o evento do culto de domingo toda semana — poder duplicar/repetir eventos.
- **Exportar/Importar voluntários (CSV)**:
  - Criado `backend/src/utils/csv.js`: parser/serializer CSV próprio (sem dependência nova), delimitador `;` (compatível com Excel pt-BR), suporta campos entre aspas com `;`, `"` ou quebra de linha.
  - `backend/src/routes/users.js`: `GET /users/export` (admin) gera CSV com colunas `name;email;phone;role;active;ministries` (múltiplos ministérios separados por `|`) e força download (`Content-Disposition: attachment`); `POST /users/import` (admin) recebe `{ csv: "<texto>" }`, identifica cada linha pelo **email**: se já existe, atualiza nome/telefone/role/active/ministérios (mantém a senha); se não existe, cria com senha provisória `mudar123` (mesmo padrão já usado na importação do PDF) — cria também os `Ministry` que não existirem. Retorna resumo `{ created, updated, errors[] }` com erros por linha (sem interromper a importação inteira).
  - `frontend/src/pages/AdminUsers.jsx`: novo card "Exportar / Importar voluntários" com botão "Exportar CSV" (baixa o arquivo via blob) e botão "Importar CSV" (input de arquivo oculto, lê o conteúdo como texto e envia para `/users/import`), exibindo o resumo da importação (criados/atualizados/erros) depois de concluída.
  - Diferente do script pontual da sessão anterior, aqui **não há nenhum nome real no código-fonte** — o CSV é fornecido pelo próprio admin a cada uso (upload) e nunca fica commitado no repositório.
- **Duplicar / repetir eventos semanalmente**:
  - `backend/src/routes/events.js`: `POST /events` agora aceita `repeatWeeks` opcional (1 a 52) — cria N eventos com o mesmo nome/necessidades, cada um 7 dias após o anterior a partir da data informada (resposta `{ events: [...] }` quando `repeatWeeks > 1`, evento único como antes quando `1`). Nova rota `POST /events/:id/duplicate` (`{ daysOffset }`, padrão 7) clona nome/data+offset/necessidades de um evento já existente para uma nova data.
  - `frontend/src/pages/AdminEvents.jsx`: formulário de criação ganhou checkbox "Repetir semanalmente" + campo "Quantidade de semanas" (usa `repeatWeeks` na criação); cada linha da tabela de eventos ganhou o botão "Duplicar (+7 dias)" para clonar rapidamente um evento existente (ex.: duplicar o culto de domingo passado para o próximo domingo, mantendo as mesmas necessidades por ministério).
- Testado nesta sessão: `node --check` em `users.js`/`events.js`/`csv.js`; teste manual do parser/serializer CSV (round-trip com aspas/`;`/pipe) via `node -e`; `npx vite build` do frontend concluído sem erros nas duas telas.
- **Pendente para o usuário validar em terminal normal** (mesma limitação de sandbox sem acesso ao Postgres/Docker): rebuildar a imagem do backend (`docker compose build backend && docker compose up -d backend`) para que as novas rotas fiquem disponíveis, e testar o fluxo real de exportar CSV, editar/reimportar, e criar/duplicar eventos semanais pela tela Admin > Eventos.

### Sessão de 09/08/2026 (parte 7 — importação da lista de voluntários do PDF)
- Pedido: carregar `docs/Lista de voluntarios.pdf` (relatório do ADJ) considerando apenas nome e função; o resto (email/telefone/senha) o admin preenche manualmente depois.
- Extraído o texto do PDF nesta sessão via `python3 -c "from pypdf import PdfReader..."` (não havia lib de PDF disponível em Node; `pypdf` já estava instalado no Python do sistema) — 26 voluntários únicos, com a coluna "Função" mapeando para 4 valores: `Recepção / Oferta`, `Iluminação`, `Projeção`, `Portaria` (alguns voluntários aparecem 2x no relatório por terem mais de uma função).
- Criado (e usado com sucesso) um script standalone (Prisma) com a lista de nome+funções extraída do PDF, que garantia (`upsert`) um `Ministry` para cada função e criava/atualizava os 26 usuários com **email/telefone/senha provisórios** para o admin editar depois em Admin > Voluntários. Rodado pelo usuário via `docker compose exec backend npm run import:voluntarios` (após rebuild da imagem para pegar o script novo) — importação concluída com sucesso.
- **Script removido do repositório após o uso** (a pedido do usuário, por conter nomes de pessoas reais) — inclusive reescrevendo o commit que o introduziu (`git commit --amend` + `push --force-with-lease`) para não deixar os nomes no histórico do git remoto. Os dados já estão apenas no banco de dados (Postgres), não mais no código-fonte.
- Se for necessário reimportar ou ajustar algo no futuro, repetir o processo manualmente pela tela Admin > Voluntários (cadastro individual) — não recriar o script com nomes reais hardcoded no repositório.

### Sessão de 09/08/2026 (parte 6 — normalização de telefone, sempre com código do Brasil)
- Pedido: campo de telefone (cadastro de voluntário, criação de usuário pelo admin, edição de qualquer usuário) deve aceitar somente números e sempre anexar o código do país `55` na frente, mesmo que o usuário digite só DDD+número (ex.: `21968030112` → `5521968030112`).
- Criado `frontend/src/utils/phone.js` e `backend/src/utils/phone.js` (mesma lógica em ambas as camadas): `formatBrazilPhone(value)` remove tudo que não é dígito e, se o resultado não começar com `55`, prefixa `55`; se já começar com `55`, mantém como está (evita duplicar o prefixo).
- Frontend: nos campos de telefone de `Register.jsx`, `AdminUsers.jsx` (form de cadastro) e `AdminUsers.jsx` (edição inline), o `onChange` agora filtra em tempo real para manter só dígitos (`replace(/\D/g, '')`) e o `onBlur`/`handleSubmit`/`saveEdit` aplicam `formatBrazilPhone` antes de enviar à API — o campo visualmente mostra o número completo com `55` já ao perder o foco.
- Backend (defesa em profundidade, caso a chamada não venha da UI): `POST /auth/register`, `POST /users` e `PUT /users/:id` agora aplicam `formatBrazilPhone(phone)` antes de salvar no banco.
- Labels dos campos atualizados para "Telefone (WhatsApp, com DDD, ex: 21968030112)" — o usuário não precisa mais digitar o `55`.
- Testado nesta sessão: `node -e` validando `formatBrazilPhone` com entradas puras, já com `55` e com formatação (parênteses/hífen) — todas retornam `5521968030112` corretamente; `npx vite build` do frontend concluído sem erros.

### Sessão de 09/08/2026 (parte 5 — correção de layout na edição inline de usuários)
- Bug relatado: ao clicar em "Editar" na tela de voluntários, a coluna de contato (email/telefone/senha) ficava colada com a coluna de função — layout quebrado.
- Causa: `th, td { white-space: nowrap }` no `index.css` (regra global da tabela) forçava os `<input>` empilhados dentro da célula de edição a ficarem todos numa linha só, vazando visualmente para a célula vizinha.
- `frontend/src/pages/AdminUsers.jsx`: células em modo de edição (nome, contato, função, ministérios, status) agora recebem `style={{ whiteSpace: 'normal', minWidth: ... }}` para sobrescrever o `nowrap` herdado, e o bloco de contato passou a usar `<div style={{ display:'flex', flexDirection:'column', gap:6 }}>` em vez de `<>...</>` com `marginTop` inline, garantindo empilhamento vertical correto dos inputs.
- Testado nesta sessão: `npx vite build` do frontend concluído sem erros.

### Sessão de 09/08/2026 (parte 4 — admin pode editar qualquer dado de qualquer usuário, incluindo o próprio admin)
- Pedido: antes só era possível editar ministérios e ativar/desativar voluntário na tela de admin; passou a ser necessário editar qualquer campo de qualquer usuário (nome, email, telefone, senha, função/role, status, ministérios), inclusive do próprio usuário admin logado (que já aparecia na lista, por não haver filtro em `GET /users`).
- `backend/src/routes/users.js` (`PUT /:id`): passou a aceitar também `email` (com checagem de duplicidade igual ao cadastro, só permitida para quem é `ADMIN`), e agora retorna o objeto completo do usuário atualizado (`id/name/email/phone/role/active/ministries`) em vez de um subconjunto, para o frontend re-renderizar corretamente após salvar. Regra de permissão mantida: usuário comum só edita a si mesmo (nome/telefone/senha), e apenas admin pode alterar `email/active/role/ministryIds` de qualquer usuário — incluindo o próprio admin trocar sua própria role, email, etc.
- `frontend/src/pages/AdminUsers.jsx`: botão "Editar ministérios" trocado por "Editar", que agora abre edição inline de nome, email, telefone, nova senha (opcional), função (select Voluntário/Admin), status (ativo) e ministérios — para qualquer linha da tabela, inclusive a do admin. `saveEdit` envia todos os campos ao `PUT /users/:id` (senha só é enviada se preenchida).
- Testado nesta sessão: `node -e "require('./src/routes/users.js')"` carrega sem erro; `npx vite build` do frontend concluído com sucesso (sem erros de sintaxe/JSX).
- Não implementado (fora do pedido): proteção contra o único admin remover a própria permissão de admin ou se desativar (deixa o sistema sem administrador) — se for um risco real, avaliar bloqueio específico numa próxima sessão.

### Sessão de 09/08/2026 (parte 3 — erro "No LID for user" ao notificar)
- Problema relatado: `Não foi possível notificar: No LID for user s (...WwCzmBwF6OP.js...)` — erro interno do próprio WhatsApp Web (não é bug do nosso código), causado pela migração do WhatsApp de IDs baseados em telefone (`@c.us`) para `LID` (Linked ID). Quando o número de destino ainda não tem o mapeamento de LID resolvido/cacheado localmente pela sessão do bot (ex.: primeiro contato com esse número), a função interna `findOrCreateLatestChat` do WhatsApp Web lança esse erro e `client.sendMessage` falha. É um bug conhecido e ainda **não corrigido** na lib `whatsapp-web.js` (issue aberta upstream).
- `backend/src/whatsapp.js` (`sendMessageNow`): ao capturar esse erro específico (`/no lid for user/i`), agora tenta resolver o mapeamento chamando `client.getContactLidAndPhone([chatId])` (método que força o WhatsApp Web a sincronizar o LID do contato) e reenviar a mensagem uma vez antes de desistir. Se falhar de novo, retorna o motivo do erro normalmente (aparece na tela do admin).
- Testado nesta sessão: módulo `whatsapp.js` carrega sem erro. Não foi possível reproduzir o erro real neste ambiente (sem WhatsApp conectado/sandbox), então a correção é baseada no comportamento documentado da lib — **recomendado validar em produção enviando notificação para um número com o qual o WhatsApp da igreja ainda não tenha conversado antes**.
- Se o erro persistir mesmo após a tentativa de resolução automática, próximos passos possíveis: (a) enviar manualmente uma mensagem para esse número pela UI do WhatsApp Web/celular uma vez (isso força o WhatsApp a criar o LID), ou (b) investigar workarounds mais agressivos discutidos na issue upstream (não implementados aqui por serem não-oficiais/arriscados).

### Sessão de 09/08/2026 (parte 2 — migração do banco de dados: SQLite → PostgreSQL)
- Motivação: usuário pediu um banco "gratuito e mais robusto" que o SQLite (arquivo único, sem concorrência real de escrita, sem replicação/backup nativo).
- `backend/prisma/schema.prisma`: `datasource db.provider` alterado de `"sqlite"` para `"postgresql"` (mesma variável `DATABASE_URL`, agora no formato `postgresql://user:senha@host:5432/db`). Comentário sobre `role`/`status` como `String` atualizado (não é mais limitação do banco, mantido por compatibilidade com o código já escrito).
- Migrations do SQLite (`20260824191235_init`, `20260825125640_add_notification_tracking`, `20260826192927_add_reminder_fields`) **removidas** — o dialeto SQL de cada banco é incompatível, então não podiam ser reaproveitadas. Criada uma única migration nova `backend/prisma/migrations/20260908000000_init_postgres/migration.sql`, gerada via `npx prisma migrate diff --from-empty --to-schema-datamodel=prisma/schema.prisma --script` (não precisa de um Postgres rodando para gerar o SQL, só para aplicá-lo depois) — contém o schema completo já com os campos de notificação/lembretes. `migration_lock.toml` atualizado para `provider = "postgresql"`.
- `docker-compose.yml`: novo serviço `postgres` (`postgres:16-alpine`, env `POSTGRES_USER/PASSWORD/DB=escala`, porta `5432:5432` exposta para dev híbrido fora do Docker, volume nomeado `postgres_data`, `healthcheck` via `pg_isready`). Serviço `backend` agora tem `depends_on: postgres (condition: service_healthy)` — só sobe depois do Postgres estar pronto — e força `environment.DATABASE_URL=postgresql://escala:escala@postgres:5432/escala` diretamente no compose (sobrescreve o que estiver no `.env`), porque dentro da rede Docker o host precisa ser o nome do serviço (`postgres`), diferente do host usado em dev local fora do Docker (`localhost`). Removido o volume antigo `backend_prisma:/app/prisma` (não é mais necessário; o SQLite morava nesse volume, o Postgres agora tem seu próprio volume `postgres_data`) — isso também elimina a causa da pasta espúria `backend/prisma/prisma/` que aparecia nesse ambiente (mount de volume relativo colidindo com o path do `DATABASE_URL=file:./prisma/dev.db`).
- `backend/.env.example`: `DATABASE_URL` trocado para `postgresql://escala:escala@postgres:5432/escala` (valor de referência para uso via Docker).
- `backend/.env` (local, não versionado): `DATABASE_URL` trocado para `postgresql://escala:escala@localhost:5432/escala` (para rodar `npm run dev` fora do Docker, contra o Postgres exposto na porta 5432 do host).
- Testado nesta sessão (sem Docker rodando neste ambiente de sandbox — mesma limitação de permissão do pipe do Docker Desktop já documentada): `npx prisma generate` gerou o client Postgres sem erros; `docker compose config` validou a sintaxe do `docker-compose.yml` e confirmou que `DATABASE_URL` resolve para `postgres:5432` dentro do container do backend.
- **Pendente para o usuário validar em terminal normal**: `docker compose up -d --build` (vai criar o Postgres, aplicar a migration nova via `prisma migrate deploy` e então subir backend/frontend) e depois `docker compose exec backend npm run seed` para (re)criar o usuário admin, já que trocar de banco significa começar com um banco vazio — os dados que estavam no SQLite não são migrados automaticamente.
- **Dependências**: nenhuma nova dependência de código foi necessária (`@prisma/client`/`prisma` já geram e conectam ao Postgres nativamente, sem precisar do pacote `pg`).

### Sessão de 09/08/2026 (conexão do WhatsApp via painel admin)
- Problema relatado: numa máquina nova, ao tentar notificar, aparecia "WhatsApp não conectado" — causa raiz era o backend nem estar em execução; ao subir, a sessão salva (`.wwebjs_auth`) falhou por `auth timeout` (rede corporativa com proxy MITM intercepta TLS de `web.whatsapp.com`), mesmo problema documentado na sessão de dockerização.
- Antes disso só era possível conectar escaneando o QR code impresso no **terminal** do backend (`qrcode-terminal`), o que é inviável em outra máquina/servidor sem acesso ao console. Implementada uma forma alternativa de conectar pelo próprio painel, logado como admin:
  - `backend/src/whatsapp.js`: guarda o último QR recebido (`lastQr`) e um flag `initializing`; extraído `findExecutablePath()`; adicionadas `getStatus()` (enabled/executableFound/ready/initializing/hasQr), `getQrDataUrl()` (usa a nova dependência `qrcode` para gerar um PNG em base64 a partir do QR) e `reconnectWhatsApp({ resetSession })` (destrói o client atual, opcionalmente apaga `.wwebjs_auth` para forçar novo QR, e chama `initWhatsApp()` de novo). Continua também logando o QR no terminal como antes.
  - `backend/package.json`: adicionada dependência `qrcode` (distinta de `qrcode-terminal`, gera data URL de imagem em vez de ASCII).
  - Nova rota `backend/src/routes/whatsapp.js` (protegida por `authRequired` + `adminOnly`): `GET /api/whatsapp/status`, `GET /api/whatsapp/qr` (retorna `{ qr: <dataURL ou null> }`), `POST /api/whatsapp/reconnect` (`{ resetSession: boolean }`). Registrada em `backend/src/index.js`.
  - Nova página `frontend/src/pages/AdminWhatsApp.jsx`: faz polling de `/whatsapp/status` a cada 4s, mostra a imagem do QR code quando disponível (via `<img src={dataURL}>`), estado "conectado"/"desconectado"/"conectando", e dois botões — **Reconectar** (tenta retomar a sessão salva) e **Gerar novo QR code (limpar sessão)** (apaga `.wwebjs_auth` e força escanear de novo). Rota `/admin/whatsapp` adicionada em `frontend/src/App.jsx` e link "WhatsApp" adicionado em `frontend/src/components/Navbar.jsx` (menu admin).
- Testado nesta sessão: módulos carregam sem erro; backend subiu e respondeu `POST /api/auth/login` (admin@admin/admin) e `GET /api/whatsapp/status` (`{"enabled":true,"executableFound":true,"ready":false,"initializing":true,"hasQr":false}`) corretamente via chamadas HTTP diretas.
- **Importante**: isso resolve a *forma* de conectar (agora dá para escanear o QR direto do navegador, sem acesso ao terminal do servidor), mas **não resolve** o `auth timeout`/`ERR_CERT_AUTHORITY_INVALID` causado pela rede com proxy MITM — isso continua exigindo testar fora dessa rede corporativa (ou configurar exceção de proxy para `web.whatsapp.com`/`*.whatsapp.net`).

### Sessão de 26/08/2026 (parte 4 — lembretes automáticos via WhatsApp)
- Implementado agendamento automático de notificações para os voluntários:
  - **24 horas antes do evento**: job de cron (`*/15 * * * *`, verifica a cada 15 min) que envia lembrete quando faltam ≤24h para o evento.
  - **No dia do evento, às 9h**: job de cron (`0 9 * * *`) que envia lembrete pela manhã do próprio dia do evento.
- `backend/prisma/schema.prisma`: adicionados os campos `reminder24hSentAt` e `reminderDaySentAt` em `ScheduleSlot`, para controlar idempotência (evitar reenvio do mesmo lembrete). Migration criada e aplicada: `20260826192927_add_reminder_fields`.
- Criado `backend/src/reminders.js`:
  - `send24hReminders()`: busca `ScheduleSlot` com `status` em `PENDING`/`CONFIRMED`, evento entre agora e agora+24h, e `reminder24hSentAt` nulo; envia mensagem via `sendMessage` (fila/throttle já existente em `whatsapp.js`) e marca `reminder24hSentAt`.
  - `sendDayOfReminders()`: busca slots com `reminderDaySentAt` nulo cujo evento é no mesmo dia (comparação de ano/mês/dia); envia mensagem e marca `reminderDaySentAt`.
  - `startReminderJobs()`: registra os dois `cron.schedule` acima (usa a lib `node-cron`, adicionada como dependência do backend).
- `backend/src/index.js`: chama `startReminderJobs()` dentro do `app.listen(...)`, junto com `initWhatsApp()`.
- `backend/package.json`: adicionada dependência `node-cron`.
- Observação importante: o agendador de **atribuição de voluntários** (`backend/src/scheduler.js`, `generateScheduleForEvent`/`generateScheduleForUpcoming`) é diferente do agendador de **lembretes por horário** (`backend/src/reminders.js`, novo nesta sessão) — o primeiro decide quem serve, o segundo decide quando notificar.
- Testado: módulo `reminders.js` carrega sem erro, `index.js` carrega sem erro (só não foi possível validar `app.listen` porque já havia uma instância do backend rodando na porta 3001 neste ambiente).

### Sessão de 26/08/2026 (parte 3 — melhorias de layout)
- Navbar (`frontend/src/components/Navbar.jsx`) responsiva: menu hambúrguer em telas ≤720px, marca "Escala" visível em mobile, bloco de usuário/"Sair" sempre alinhado à direita (`margin-left: auto` em `.navbar-right`).
- Tabelas de todas as páginas (`AdminSchedule`, `AdminUsers`, `AdminEvents`, `AdminMinistries`, `VolunteerHome`, `VolunteerUnavailability`) envolvidas por `.table-wrap` com `overflow-x: auto`, evitando vazamento em mobile.
- `frontend/src/index.css`: cores, espaçamentos e raios de borda centralizados em variáveis CSS (`:root`); cor primária trocada de verde (`#1f4b3f`) para preto (`#1a1a1a`/`#000000`); breakpoints adicionados para `.container`, `.grid-2` e `.login-box`.
- Containers Docker de teste (`escala-frontend`) recompilados e recriados manualmente (`docker build` + `docker run`) para validar as mudanças de layout nesta sessão.

### Sessão de 26/08/2026 (parte 2)
- Implementado delay/throttle no envio de mensagens do WhatsApp (`backend/src/whatsapp.js`) para reduzir risco de bloqueio ao notificar escalas em lote (cenário de ~50 usuários).
  - `sendMessage` agora enfileira os envios (`sendQueue`) garantindo execução sequencial, mesmo quando chamado em paralelo (ex.: `Promise.all` em `backend/src/routes/schedule.js`).
  - Após cada envio bem-sucedido, aguarda um delay aleatório entre `WHATSAPP_MIN_DELAY_MS` (padrão 2000ms) e `WHATSAPP_MAX_DELAY_MS` (padrão 4000ms), configuráveis via `.env`.
- Ajustado seed (`backend/prisma/seed.js`): admin de teste agora usa `admin@admin` / `admin` (antes `admin@igreja.com` / `admin123`) e o upsert passou a atualizar a senha (`update: { passwordHash }`) em execuções futuras do seed.

### Sessão de 26/08/2026
- Retomado o trabalho de dockerização iniciado na sessão anterior (backend já buildava, frontend estava pendente).
- Build do frontend (`docker build ./frontend`): sucesso.
- Build do backend (`docker build ./backend`): sucesso.
- Corrigido bug crítico: aspas em `backend/.env` quebravam `DATABASE_URL` dentro do container (ver seção "Dockerização" acima).
- `docker compose up`/`build` bloqueado por permissão no ambiente de sandbox deste assistente; validado o equivalente via `docker run` manual com mesma network/volumes/env — stack completa funcionando (frontend, proxy `/api`, migrations, health check).
- Containers de teste deixados rodando (`escala-backend` na porta 3001, `escala-frontend` na porta 8080).

### Sessão de 25/08/2026
- Usuário pediu para criar este arquivo de acompanhamento para não perder o progresso entre sessões.
- Revisado todo o código do frontend (App, contexto de auth, todas as páginas, Navbar, client da API) — está completo e íntegro.
- Nenhuma alteração de código feita nesta sessão além da criação deste arquivo.
