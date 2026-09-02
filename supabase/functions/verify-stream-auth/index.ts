// Supabase Edge Function: verify-stream-auth
//
// O MediaMTX está configurado com `authMethod: http` a apontar para esta
// função. Antes de deixar alguém publicar (RTMP) ou ver (HLS/WebRTC) um
// stream, o MediaMTX faz um pedido HTTP aqui com os detalhes do pedido.
// Devolvemos 200 se a pessoa tiver uma sessão Supabase válida, 401 caso
// contrário.
//
// O cliente (app) passa o token de acesso Supabase como query param
// ?token=... no URL do stream (ex: .../cuas1/index.m3u8?token=eyJ...).
// O MediaMTX inclui esse query param no pedido que nos faz.

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    // O MediaMTX envia um JSON com detalhes do pedido — incluindo a query
    // string original do URL do stream. Ver documentação "authMethod: http".
    const body = await req.json().catch(() => ({}));
    const query = body?.query ?? "";
    const params = new URLSearchParams(query);
    const token = params.get("token");

    if (!token) {
      return new Response("sem token", { status: 401 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return new Response("token inválido", { status: 401 });
    }

    // Autenticado — o MediaMTX só precisa de saber que pode deixar passar.
    // Se mais tarde quiseres restringir por função (ex: só admin/gestor
    // vê o C-UAS), dá para consultar aqui a tabela profiles com este user.id.
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("erro interno", { status: 500 });
  }
});
