// Supabase Edge Function: create-pilot
//
// Cria uma conta de login (Supabase Auth) e o respetivo perfil.
// Só pode ser chamada por um utilizador autenticado com role admin/gestor —
// por isso precisa de correr no servidor (usa a service role key, que
// nunca deve estar no browser).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "x");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    // 1. Confirma que quem está a chamar é admin/gestor — usa o token do
    // próprio pedido (não a service role) para verificar a identidade.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || !["admin", "gestor"].includes(callerProfile.role)) {
      return jsonResponse({ error: "Sem permissão — só admin/gestor pode criar contas." }, 403);
    }

    // 2. Lê os dados do novo piloto
    const body = await req.json();
    const { full_name, email, phone, role, nm, posto, subunidade, pelotao, area_funcional } = body;

    if (!full_name || !email) {
      return jsonResponse({ error: "Nome e email são obrigatórios." }, 400);
    }

    // 3. Cria a conta com a service role (só possível no servidor)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const password = generatePassword();
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return jsonResponse({ error: `Erro ao criar conta: ${authError.message}` }, 400);
    }

    // 4. Cria o perfil associado
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authUser.user.id,
      full_name,
      email,
      phone: phone || null,
      role: role || "piloto",
      nm: nm || null,
      posto: posto || null,
      subunidade: subunidade || null,
      pelotao: pelotao || null,
      area_funcional: area_funcional || null,
    });

    if (profileError) {
      // reverte a conta criada, para não ficar órfã
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return jsonResponse({ error: `Erro ao criar perfil: ${profileError.message}` }, 400);
    }

    return jsonResponse({ ok: true, profile_id: authUser.user.id, email, password });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: String(err?.message ?? err) }, 500);
  }
});
