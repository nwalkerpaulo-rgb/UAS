# Folha de Testes — GIOP UAS C-UAS Operações

Checklist para testar toda a aplicação de ponta a ponta. Marca cada item como ✅ ou ❌ e anota o que falhar, com o texto exato do erro (aparece agora a vermelho no ecrã, ou na consola do browser — F12 → Console).

---

## 0. Pré-requisitos antes de começar

- [ ] Todas as migrações (002 a 010) foram corridas no SQL Editor do Supabase, por ordem
- [ ] Os 3 buckets de Storage existem: `documents`, `photos`, `logs` — marcados como **Public**
- [ ] Edge Functions publicadas: `process-dji-log`, `create-pilot`, `verify-stream-auth`
- [ ] Existe pelo menos 1 conta `admin` criada (tu)
- [ ] `.env` preenchido e `npm run dev` a correr sem erros

---

## 1. Autenticação e Perfil

| # | Passo | Resultado esperado |
|---|---|---|
| 1.1 | Abrir a app sem sessão iniciada | Mostra o ecrã de Login, não o Dashboard |
| 1.2 | Login com email/password errados | Mensagem de erro clara, não trava a app |
| 1.3 | Login com credenciais corretas | Entra no Dashboard |
| 1.4 | Menu lateral (ou topo, em mobile) mostra o teu nome e função | Nome e "Admin"/"Piloto"/etc. corretos |
| 1.5 | Configurações → O meu perfil → mudar nome/telefone → Guardar | Mensagem "✓ Guardado"; recarregar a página mantém os dados novos |
| 1.6 | Configurações → mudar foto de perfil | Foto aparece depois de recarregar |
| 1.7 | Configurações → mudar password → login de novo com a password nova | Login funciona com a password nova |
| 1.8 | Botão "Sair" | Volta ao ecrã de login |

---

## 2. Pilotos e Habilitações

| # | Passo | Resultado esperado |
|---|---|---|
| 2.1 | (admin) Pilotos → "+ Criar Piloto" | Abre o formulário |
| 2.2 | Preencher NM → o campo Email preenche sozinho como `gNM@gnr.pt` | Email correto |
| 2.3 | Adicionar 2-3 habilitações com nomes diferentes (ex: "A1", "Curso C-UAS", "Curso Especial X") | Consegues escrever qualquer nome, não fica preso a uma lista |
| 2.4 | Anexar um PDF a pelo menos uma habilitação | Ficheiro aceite |
| 2.5 | Criar conta | Mostra o ecrã com email + password gerados |
| 2.6 | Ir a Pilotos → o novo piloto aparece na lista | Contagem de habilitações correta |
| 2.7 | Abrir a ficha desse piloto | Mostra as habilitações todas, com o PDF acessível em "Ver diploma" |
| 2.8 | Na ficha do piloto → "+ Adicionar habilitação" → criar mais uma, com diploma | Aparece na lista, PDF abre |
| 2.9 | Remover uma habilitação (✕) | Desaparece da lista |
| 2.10 | Mudar foto do piloto (lápis no canto) | Foto atualizada |
| 2.11 | Login com o email/password gerados no passo 2.5 (numa janela anónima) | Entra na app como esse piloto |
| 2.12 | Pilotos → filtrar por um curso específico (dropdown) | Só mostra quem tem esse curso |
| 2.13 | Com filtro ativo → "Exportar lista (CSV)" | Ficheiro CSV descarrega, abre no Excel com os dados certos |

---

## 3. Drones, Baterias, Sistemas C-UAS

| # | Passo | Resultado esperado |
|---|---|---|
| 3.1 | Drones → "+ Novo drone" → preencher e guardar | Aparece na lista |
| 3.2 | Abrir a ficha do drone | Mostra horas de voo, missões, botão de QR Code |
| 3.3 | Clicar "Mostrar QR Code" → "Descarregar PNG" | Ficheiro PNG descarrega com o código |
| 3.4 | Baterias → criar uma associada a "Drone" | Aparece ligada ao drone certo |
| 3.5 | Criar outra bateria associada a "Sistema C-UAS" | Aparece ligada ao sistema certo |
| 3.6 | Criar bateria "Nenhum (sobresselente)" | Cria sem associação, sem erro |
| 3.7 | Abrir ficha de uma bateria | Mostra Battery Health Score, ciclos, horas |
| 3.8 | Contra-Drone (Sistemas) → criar um sistema novo | Aparece na lista |
| 3.9 | Abrir ficha do sistema C-UAS | Mostra QR code, missões, deteções, baterias associadas |
| 3.10 | Equipamento → criar item → "Levantar" → "Devolver" | Estado muda entre disponível/ocupado |

---

## 4. Sessões (Serviços)

| # | Passo | Resultado esperado |
|---|---|---|
| 4.1 | Início → "+ Iniciar Serviço" | Abre formulário, tenta obter GPS |
| 4.2 | Negar permissão de GPS no browser | Continua a deixar avançar preenchendo coordenadas à mão ou sem elas |
| 4.3 | Preencher local, selecionar mais utilizadores presentes | Lista de utilizadores carrega |
| 4.4 | Confirmar início | Sem erro; a HUD amarela aparece no topo com o cronómetro a contar |
| 4.5 | Clicar na HUD | Vai para a ficha da sessão |
| 4.6 | Na sessão: "+ Adicionar foto" | Foto aparece na grelha depois de carregar |
| 4.7 | Fechar o browser e reabrir a app | A HUD continua a mostrar o serviço em curso, cronómetro correto |
| 4.8 | Sessões (lista) → filtrar por estado "Aberta" | Mostra só as abertas |
| 4.9 | Na sessão aberta → "Fechar Serviço" | Pede GPS de fim, confirma, estado muda para "fechada" |
| 4.10 | HUD amarela desaparece depois de fechar | Confirmado |

---

## 5. Missões

### 5.1 Missão rápida dentro de uma sessão
| # | Passo | Resultado esperado |
|---|---|---|
| 5.1.1 | Sessão aberta → "+ Adicionar missão" → tipo "UAS" | Mostra seletor de Drone |
| 5.1.2 | Mudar tipo para "C-UAS" | Seletor muda para Sistema C-UAS |
| 5.1.3 | Escolher observador (deve vir da lista de pilotos) | Lista só mostra contas com função piloto |
| 5.1.4 | Guardar | Missão aparece na sessão, com nome do equipamento certo |
| 5.1.5 | Adicionar uma segunda missão de tipo diferente à mesma sessão | Ambas aparecem, sem se substituírem |

### 5.2 Planeamento completo
| # | Passo | Resultado esperado |
|---|---|---|
| 5.2.1 | Operações → Planeamento → "+ Nova missão" | Abre formulário completo |
| 5.2.2 | Preencher tipo, drone, piloto, data | Campos aceites |
| 5.2.3 | Meteorologia → "Obter pelo local" (com um local real escrito, ex: "Lisboa") | Mostra temperatura, vento, etc. |
| 5.2.4 | Meteorologia → "Obter pelo GPS" | Mesma coisa, usando localização atual |
| 5.2.5 | Check Operacional — ver os 6 itens a atualizar sozinhos consoante o piloto/drone escolhido | Ícones verdes/vermelhos corretos |
| 5.2.6 | Marcar "Área verificada" e "Documentação válida" manualmente | Quando os 6 ficam ok, aparece "✓ MISSÃO PRONTA" |
| 5.2.7 | Guardar | Vai para a lista de Planeamento |
| 5.2.8 | Planeamento → mudar estado (Marcar como pronta → Iniciar → Concluir) | Estados avançam corretamente |
| 5.2.9 | A partir de dentro de uma sessão → "Planeamento completo →" | Abre o mesmo formulário, mas ligado a essa sessão |
| 5.2.10 | Guardar essa missão | Volta para a sessão de origem, missão lá aparece |

### 5.3 Log DJI
| # | Passo | Resultado esperado |
|---|---|---|
| 5.3.1 | Numa missão com drone, sem log ainda | Mostra "Fazer upload do log de voo" |
| 5.3.2 | Enviar um ficheiro `.DAT` ou `.txt` real | Estado passa a "A decifrar log..." e depois "✓ Log processado" ou mostra erro claro |
| 5.3.3 | Se processado: ver tempo de voo, distância, altitude preenchidos | Valores plausíveis (não negativos, não absurdos) |
| 5.3.4 | Verificar se a bateria/drone associados tiveram as horas atualizadas | Confirmar na ficha do drone/bateria |

### 5.4 Lista geral de missões
| # | Passo | Resultado esperado |
|---|---|---|
| 5.4.1 | Missões → filtrar por estado | Lista filtra corretamente |
| 5.4.2 | Confirmar que aparecem tanto as UAS como as C-UAS | Ambas visíveis |

---

## 6. Deteções C-UAS

| # | Passo | Resultado esperado |
|---|---|---|
| 6.1 | C-UAS → Deteções → "+ Registar deteção" | Abre formulário |
| 6.2 | Preencher sistema, classificação, tipo, azimute, distância | Campos aceites |
| 6.3 | Usar GPS ou coordenadas manuais | Ambos funcionam |
| 6.4 | Guardar | Aparece na lista, contadores no topo atualizam (hoje/identificadas/suspeitas) |
| 6.5 | Filtrar por classificação | Lista filtra |
| 6.6 | Ver a deteção na ficha do sistema C-UAS correspondente | Aparece no histórico |
| 6.7 | Ver a deteção no Mapa Operacional (camada "Deteções") | Marcador aparece na posição certa |

---

## 7. Incidentes

| # | Passo | Resultado esperado |
|---|---|---|
| 7.1 | Ocorrências → "+ Registar ocorrência" | Abre formulário |
| 7.2 | Preencher título, local, gravidade | Aceite |
| 7.3 | Associar a uma missão (se vier de dentro de uma sessão) | Dropdown aparece |
| 7.4 | Associar a uma deteção C-UAS recente | Dropdown aparece, lista as últimas 20 |
| 7.5 | Anexar fotos | Fotos ficam guardadas |
| 7.6 | Guardar | Vai para a ficha de detalhe |
| 7.7 | (admin) Mudar estado (Reportada → Em investigação → Fechada) | Estado muda, badge atualiza |
| 7.8 | (admin) Atribuir investigador | Guarda corretamente |
| 7.9 | Se ligada a uma missão com log processado, ver dados de voo na ficha | Tempo/distância/altitude aparecem |
| 7.10 | Se ligada a uma deteção, ver os dados dela na ficha | Tipo/classificação/distância aparecem |
| 7.11 | Ver a ocorrência no Mapa Operacional | Marcador correto, cor por gravidade |

---

## 8. Manutenção

| # | Passo | Resultado esperado |
|---|---|---|
| 8.1 | Manutenção → "+ Registar manutenção" | Escolher tipo de ativo (drone/bateria/C-UAS/equipamento) |
| 8.2 | Preencher data e próxima manutenção prevista | Aceite |
| 8.3 | Guardar | Aparece no histórico |
| 8.4 | Se a data prevista for < 30 dias, aparece em "Alertas — próximos 30 dias" no topo da página | Confirmado |
| 8.5 | Ver o mesmo aviso na ficha do drone/sistema em causa | "Manutenção vencida/próxima" visível |

---

## 9. Mapa, Heatmaps, Bases

| # | Passo | Resultado esperado |
|---|---|---|
| 9.1 | Mapas → Operações | Mapa carrega, centrado em Portugal |
| 9.2 | Ligar/desligar cada camada (Missões, Incidentes, Sessões, Deteções, Bases) | Marcadores aparecem/desaparecem |
| 9.3 | Filtrar por período/piloto/tipo | Marcadores atualizam |
| 9.4 | Clicar num marcador | Popup com detalhes e link para o registo |
| 9.5 | Mapas → Heatmaps → "Densidade operacional" | Mapa de calor visível (só se houver missões com GPS) |
| 9.6 | Heatmaps → "Densidade de incidentes" | Mapa de calor visível |
| 9.7 | Mapas → Bases → "+ Nova base" | Criar com GPS ou manual |
| 9.8 | Confirmar que a base aparece no Mapa Operacional | Marcador em diamante dourado |

---

## 10. Análise e Relatórios

| # | Passo | Resultado esperado |
|---|---|---|
| 10.1 | Análise | Gráficos carregam (missões por mês, taxa de sucesso, horas por piloto, por drone, por tipo) |
| 10.2 | Se não houver dados suficientes | Mensagem clara, não erro |
| 10.3 | Relatórios → escolher período → "Gerar relatório" | Resumo executivo aparece |
| 10.4 | "Exportar CSV" | Ficheiro descarrega com as missões do período |
| 10.5 | "Imprimir / Guardar PDF" | Abre o diálogo de impressão do browser, layout limpo |

---

## 11. Alertas

| # | Passo | Resultado esperado |
|---|---|---|
| 11.1 | Alertas | Lista carrega, agrupada por gravidade (crítico/alto/médio) |
| 11.2 | Forçar uma condição (ex: mudar estado de um drone para "inativo") | Aparece um alerta novo |
| 11.3 | Clicar num alerta | Vai para a ficha do ativo em causa |
| 11.4 | Sem nenhum alerta pendente | Mensagem "✓ Sem alertas" |
| 11.5 | O contador "Alertas" no Dashboard bate certo com esta página | Números iguais |

---

## 12. Configurações da Organização (admin)

| # | Passo | Resultado esperado |
|---|---|---|
| 12.1 | Configurações → Definições da organização | 4 campos numéricos visíveis |
| 12.2 | Mudar "Limite de rajada de vento" para um valor baixo (ex: 1) | Guardar |
| 12.3 | Ir a Planeamento de missão → obter meteorologia com vento acima desse valor | Aviso "⚠ Rajadas fortes" aparece |
| 12.4 | Mudar "Ciclos máximos de bateria" | Ver o Battery Health Score de uma bateria mudar de acordo |
| 12.5 | (não-admin) Entrar em Configurações | Só vê "O meu perfil", não vê Definições da organização |

---

## 13. Importação em massa (Excel)

| # | Passo | Resultado esperado |
|---|---|---|
| 13.1 | `node scripts/import-excel.mjs ficheiro.xlsx --dry-run` | Mostra resumo sem escrever nada |
| 13.2 | Confirmar contagens (pessoas, habilitações, missões) fazem sentido | Sem avisos inesperados |
| 13.3 | Correr sem `--dry-run` (com `.env.import` configurado) | Cria contas, habilitações, missões |
| 13.4 | Verificar ficheiro de credenciais gerado em `scripts/output/` | CSV com email+password por pessoa nova |
| 13.5 | Correr o script uma segunda vez com o mesmo ficheiro | Não duplica pessoas nem habilitações (idempotente) |

---

## 14. Permissões por função

| # | Passo | Resultado esperado |
|---|---|---|
| 14.1 | Login como "piloto" | Não vê "Pilotos" no menu, não vê Definições da organização |
| 14.2 | Piloto tenta ver sessão de outra pessoa (URL direto) | Bloqueado ou não encontrado, consoante RLS |
| 14.3 | Piloto vê as próprias missões/sessões/ocorrências | Vê normalmente |
| 14.4 | Login como "gestor" | Vê tudo como admin, exceto o que for exclusivo de admin (confirmar quais) |

---

## 15. Instalação como App (PWA)

| # | Passo | Resultado esperado |
|---|---|---|
| 15.1 | Abrir o link publicado no Chrome Android | Aparece opção "Adicionar ao ecrã principal" |
| 15.2 | Instalar | Ícone do brasão aparece no ecrã principal |
| 15.3 | Abrir a app instalada | Abre em ecrã completo, sem barra de endereço |
| 15.4 | Repetir em Mac/PC (Chrome/Edge) | Ícone de instalação na barra de endereço funciona |

---

## 16. Streaming (Operações ao Vivo) — opcional, só se já tiveres o servidor a correr

| # | Passo | Resultado esperado |
|---|---|---|
| 16.1 | `docker compose up -d` na máquina certa | Containers `mediamtx` e `cuas-capture` a correr sem reiniciar em loop |
| 16.2 | `ffplay rtmp://.../cuas1` a partir de outro computador na rede | Mostra o ecrã do sistema C-UAS |
| 16.3 | Pilot 2 a enviar RTMP para o `drone1` | MediaMTX recebe (ver logs) |
| 16.4 | App → Operações ao Vivo → configurar endereço do servidor | Guardado localmente |
| 16.5 | Ver os dois feeds na app | Vídeo aparece, ponto verde a piscar |
| 16.6 | Sair da sessão (logout) e tentar aceder ao stream diretamente pelo URL | Bloqueado (401) |

---

## Resumo de problemas encontrados

| Nº do teste | Descrição do problema | Erro exato (se houver) |
|---|---|---|
| | | |
| | | |
| | | |
