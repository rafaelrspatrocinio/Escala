const BASE = 'http://localhost:3001/api';

let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FALHOU: ${msg}`);
  } else {
    console.log(`OK: ${msg}`);
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function main() {
  const rand = Date.now();

  // 1. Login admin
  const adminLogin = await req('POST', '/auth/login', { email: 'admin@admin', password: 'admin' });
  assert(adminLogin.status === 200 && adminLogin.body.token, 'login admin');
  const adminToken = adminLogin.body.token;

  // 2. Registrar voluntário
  const email = `voluntario${rand}@teste.com`;
  const register = await req('POST', '/auth/register', {
    name: 'Voluntário Teste',
    email,
    phone: '11999998888',
    password: 'senha123',
  });
  assert(register.status === 201, 'cadastro de voluntário');

  // 3. Login voluntário
  const volLogin = await req('POST', '/auth/login', { email, password: 'senha123' });
  assert(volLogin.status === 200 && volLogin.body.token, 'login voluntário');
  const volToken = volLogin.body.token;
  const volId = volLogin.body.user.id;

  // 4. /users/me
  const me = await req('GET', '/users/me', null, volToken);
  assert(me.status === 200 && me.body.email === email, 'GET /users/me retorna usuário logado');

  // 5. Criar ministério (admin)
  const ministryName = `Louvor ${rand}`;
  const ministry = await req('POST', '/ministries', { name: ministryName }, adminToken);
  assert(ministry.status === 201, 'criação de ministério');
  const ministryId = ministry.body.id;

  // 6. Adicionar voluntário ao ministério (admin, via users)
  const addToMinistry = await req('PUT', `/users/${volId}`, { ministryIds: [ministryId] }, adminToken);
  assert(addToMinistry.status === 200, 'associar voluntário ao ministério');

  // 7. Criar evento (admin)
  const eventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const event = await req('POST', '/events', {
    name: `Culto Teste ${rand}`,
    date: eventDate,
    needs: [{ ministryId, slotsCount: 1 }],
  }, adminToken);
  assert(event.status === 201, 'criação de evento');
  const eventId = event.body.id;

  // 8. Gerar escala (admin)
  const genSchedule = await req('POST', `/schedule/generate/${eventId}`, null, adminToken);
  assert(genSchedule.status === 201, 'geração de escala');
  assert(genSchedule.body.created === 1, `escala criada para 1 vaga (recebido: ${genSchedule.body.created})`);
  const slot = genSchedule.body.slots?.[0];
  assert(slot && slot.userId === volId, 'voluntário correto foi escalado');

  // 9. Voluntário vê sua escala
  const mySchedule = await req('GET', '/schedule', null, volToken);
  assert(mySchedule.status === 200 && mySchedule.body.some((s) => s.id === slot.id), 'voluntário vê sua própria escala');

  // 10. Voluntário confirma presença
  const confirm = await req('POST', `/schedule/${slot.id}/confirm`, null, volToken);
  assert(confirm.status === 200 && confirm.body.status === 'CONFIRMED', 'voluntário confirma presença');

  // 11. Cadastrar indisponibilidade
  const unavailDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const unavail = await req('POST', '/unavailability', { date: unavailDate, reason: 'Viagem' }, volToken);
  assert(unavail.status === 201, 'cadastro de indisponibilidade');
  const unavailId = unavail.body.id;

  // 12. Listar indisponibilidade
  const unavailList = await req('GET', '/unavailability', null, volToken);
  assert(unavailList.status === 200 && unavailList.body.some((u) => u.id === unavailId), 'listagem de indisponibilidade');

  // 13. Remover indisponibilidade
  const unavailDel = await req('DELETE', `/unavailability/${unavailId}`, null, volToken);
  assert(unavailDel.status === 204, 'remoção de indisponibilidade');

  // 14. Criar 2º evento (consecutivo ao 1º) e testar recusa
  // Regra: um voluntário não pode ser escalado em dois eventos consecutivos
  // (ver PROGRESSO.md parte 22), então é preciso um 2º voluntário no mesmo
  // ministério para o evento 2 conseguir ser preenchido automaticamente.
  const email2 = `voluntario2-${rand}@teste.com`;
  const register2 = await req('POST', '/auth/register', {
    name: 'Voluntário Teste 2',
    email: email2,
    phone: '11999997777',
    password: 'senha123',
  });
  assert(register2.status === 201, 'cadastro do 2º voluntário');
  const volId2 = register2.body.id;
  const addToMinistry2 = await req('PUT', `/users/${volId2}`, { ministryIds: [ministryId] }, adminToken);
  assert(addToMinistry2.status === 200, 'associar 2º voluntário ao ministério');

  const event2Date = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const event2 = await req('POST', '/events', {
    name: `Culto Teste 2 ${rand}`,
    date: event2Date,
    needs: [{ ministryId, slotsCount: 1 }],
  }, adminToken);
  const event2Id = event2.body.id;
  const gen2 = await req('POST', `/schedule/generate/${event2Id}`, null, adminToken);
  const slot2 = gen2.body.slots?.[0];
  assert(
    slot2 && slot2.userId === volId2,
    'voluntário diferente foi escalado no evento 2 (não repete quem serviu no evento anterior)'
  );

  const decline = await req('POST', `/schedule/${slot2.id}/decline`, null, adminToken);
  assert(decline.status === 200 && decline.body.status === 'DECLINED', 'recusa de presença no evento 2');

  // 15. Admin remove escala
  const delSlot = await req('DELETE', `/schedule/${slot2.id}`, null, adminToken);
  assert(delSlot.status === 204, 'admin remove escala');

  // 16. Segurança: voluntário não pode acessar rota admin
  const forbidden = await req('POST', '/ministries', { name: 'Hack' }, volToken);
  assert(forbidden.status === 403, 'voluntário não pode criar ministério (403 esperado)');

  // 17. Segurança: sem token
  const noAuth = await req('GET', '/schedule', null, null);
  assert(noAuth.status === 401, 'sem token retorna 401');

  // 18. Login com senha errada
  const badLogin = await req('POST', '/auth/login', { email, password: 'errada' });
  assert(badLogin.status === 401, 'login com senha errada retorna 401');

  // 19. Admin lista voluntários
  const usersList = await req('GET', '/users', null, adminToken);
  assert(usersList.status === 200 && usersList.body.some((u) => u.id === volId), 'admin lista voluntários');

  // Limpeza
  await req('DELETE', `/events/${eventId}`, null, adminToken);
  await req('DELETE', `/events/${event2Id}`, null, adminToken);
  await req('DELETE', `/users/${volId2}`, null, adminToken);
  await req('DELETE', `/ministries/${ministryId}`, null, adminToken);

  console.log('\n' + '='.repeat(50));
  if (failures === 0) {
    console.log('TODOS OS TESTES PASSARAM');
  } else {
    console.log(`${failures} TESTE(S) FALHARAM`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('ERRO FATAL NO TESTE:', err);
  process.exitCode = 1;
});
