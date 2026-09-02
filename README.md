# OPS.DRONE

Aplicacao de gestao de utilizadores, drones, contra-drones, baterias, missoes e ocorrencias.
Corre em PC, Mac e Android como PWA (instalavel a partir do browser) e sincroniza tudo em tempo real via Supabase.

## 1. Criar o backend (Supabase - gratis)

1. Cria conta em supabase.com e um novo projeto.
2. No dashboard, vai a SQL Editor e corre o conteudo de supabase/schema.sql (cria todas as tabelas, permissoes e regras de acesso por funcao).
3. Vai a Storage e cria 3 buckets, todos privados:
   - documents (certificacoes, medico, formacao)
   - photos (fotos de sessao e ocorrencias)
   - logs (ficheiros de voo .DAT / .txt)
4. Vai a Project Settings -> API e copia:
   - Project URL
   - anon public key

## 2. Configurar a aplicacao

    cp .env.example .env

Edita .env e cola os valores do passo anterior:

    VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
    VITE_SUPABASE_ANON_KEY=eyJ...

    npm install
    npm run dev

## 3. Criar os primeiros utilizadores

Os logins fazem-se por email/password via Supabase Auth. Para criar o primeiro admin:

1. No dashboard Supabase, vai a Authentication -> Users -> Add user, cria o utilizador.
2. Vai a Table Editor -> profiles, adiciona uma linha com o mesmo id do utilizador criado, role = admin.
3. A partir dai, o admin consegue gerir a restante equipa dentro da propria aplicacao (pagina Utilizadores).

## 4. Publicar (gratis)

    npm run build

Sobe a pasta dist/ para Vercel ou Netlify (plano gratis chega folgadamente para 20+ utilizadores). Qualquer um dos dois deteta o Vite automaticamente - basta ligar o repositorio e definir as duas variaveis de ambiente do passo 2 no painel deles.

Depois de publicado, em Android basta abrir o link no Chrome e escolher "Adicionar ao ecra principal" - instala como app nativa (PWA). Em Mac/PC, o Chrome/Edge mostra um icone de instalacao na barra de enderecos.

## 5. Importacao e decifra de logs DJI (Pilot) - implementado

Ja esta tudo ligado: upload do log na missao -> Edge Function decifra -> preenche tempo de voo, distancia, altitude e tenta associar a bateria pelo numero de serie.

### 5.1 Obter a API key da DJI (gratis)

1. Cria conta em developer.dji.com.
2. CREATE APP -> tipo "Open API" -> preenche nome/categoria/descricao.
3. Ativa a app pelo link que chega por email.
4. Na pagina da app, copia o "ApiKey" (tambem chamado SDK key).

### 5.2 Instalar a Supabase CLI e publicar a funcao

    npm install -g supabase
    supabase login
    supabase link --project-ref xxxxxxxx   # o ref aparece no URL do teu projeto Supabase

    # Correr a migracao que adiciona as colunas de estado do log
    # (SQL Editor do Supabase -> colar o conteudo de supabase/migrations/002_dji_log_processing.sql)

    # Definir o segredo com a API key da DJI
    supabase secrets set DJI_API_KEY=coloca_aqui_a_tua_chave

    # Publicar a funcao
    supabase functions deploy process-dji-log

Nao precisas de configurar SUPABASE_URL nem SUPABASE_SERVICE_ROLE_KEY manualmente - o Supabase injeta-os automaticamente nas Edge Functions.

### 5.3 Como funciona no fluxo da aplicacao

1. Na pagina de uma missao com drone associado, o piloto faz upload do .DAT/.txt.
2. O ficheiro vai para o bucket privado logs.
3. A aplicacao chama a Edge Function process-dji-log, que descarrega o ficheiro, pede as keychains a API da DJI (se o log for encriptado, versao 13+), decifra e extrai tempo de voo, distancia e altitude maxima.
4. A missao fica com log_status = concluido e os dados preenchidos. Se encontrar o numero de serie da bateria usada, tenta associar a uma bateria ja registada e incrementa os ciclos e horas de voo dela. As horas de voo do drone tambem sao atualizadas.
5. Se algo falhar (chave invalida, formato inesperado), a missao fica com log_status = erro e a mensagem de erro visivel na app, com opcao de tentar novamente.

### 5.4 Nota importante sobre o formato

O parser usado (dji-log-parser-js, MIT) documenta os nomes de campo totalTime, totalDistance, maxHeight para as metricas gerais - e isso e o que a funcao usa. Ainda assim, vale a pena testares com um .DAT real do teu drone assim que possivel: se os nomes ou as unidades vierem diferentes (ex: decimos de segundo em vez de segundos), e um ajuste pequeno no ficheiro supabase/functions/process-dji-log/index.ts, na zona comentada "extrair metricas". O campo do numero de serie da bateria e o mais incerto - se nao for encontrado automaticamente, a missao fica sem bateria associada mas o resto dos dados processa na mesma.

## Estrutura

    src/
      context/AuthContext.jsx   -> sessao e perfil do utilizador
      hooks/                    -> GPS, sessao ativa
      components/               -> UI reutilizavel, layout, HUD de sessao ativa
      pages/                    -> um ficheiro por ecra
    supabase/schema.sql         -> schema completo + regras de acesso (RLS)
