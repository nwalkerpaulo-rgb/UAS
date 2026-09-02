# Deploy das Edge Functions

Precisas da Supabase CLI. Se ainda não a tens instalada:

```
npm install -g supabase
supabase login
```

Depois, dentro da pasta `drone-manager`:

```
supabase link --project-ref O_TEU_PROJECT_REF
```

(o project-ref aparece no URL do teu projeto: `https://O_TEU_PROJECT_REF.supabase.co`)

## 1. process-dji-log (decifra logs de voo)

```
supabase secrets set DJI_API_KEY=a_tua_chave_da_dji
supabase functions deploy process-dji-log
```

## 2. create-pilot (criar contas de piloto a partir da app)

Não precisa de segredos extra.

```
supabase functions deploy create-pilot
```

## 3. verify-stream-auth (autenticação do streaming — só se fores usar isso já)

Não precisa de segredos extra.

```
supabase functions deploy verify-stream-auth
```

## Confirmar que ficaram publicadas

```
supabase functions list
```

Deve mostrar as três com estado ACTIVE.

## Testar rapidamente

Na app, tenta:
- Criar um piloto (testa `create-pilot`)
- Fazer upload de um log numa missão (testa `process-dji-log`)

Se aparecer "Failed to fetch" ou erro 404 ao usar estas funcionalidades, confirma com `supabase functions list` se estão mesmo publicadas.
