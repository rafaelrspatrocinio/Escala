// Datas de evento são salvas tratando os dígitos digitados pelo admin como
// se fossem UTC (ex.: digitou "18:30" -> gravado como "18:30:00Z"). Para
// exibir de volta exatamente os mesmos dígitos, independente do fuso horário
// configurado no navegador de quem está acessando, é preciso formatar sempre
// com timeZone: 'UTC' (senão o horário aparece deslocado conforme o fuso
// local do dispositivo). Ver PROGRESSO.md, partes 14 e 20.

export function formatEventDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'UTC' });
}

export function formatEventDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
