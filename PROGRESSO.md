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
