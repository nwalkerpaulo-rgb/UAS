// Supabase Edge Function: process-dji-log
//
// Recebe { mission_id }, descarrega o ficheiro de log associado do bucket
// privado "logs", decifra-o (pedindo as keychains à API da DJI quando
// necessário) e atualiza a missão, a bateria e o drone com os dados extraídos.
//
// Segredos necessários (definir com `supabase secrets set`):
//   DJI_API_KEY               -> API key da app criada em developer.dji.com
//   SUPABASE_URL               -> injetado automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY  -> injetado automaticamente pelo Supabase
//
// NOTA IMPORTANTE: os nomes de campos usados abaixo (details.totalTime,
// details.totalDistance, details.maxHeight, etc.) são os documentados pela
// biblioteca dji-log-parser-js à data desta implementação. Vale a pena
// confirmar com um log real do teu drone — se os nomes ou unidades vierem
// diferentes, é só ajustar o bloco "extrair métricas" mais abaixo.

import { createClient } from "npm:@supabase/supabase-js@2";
import { DJILog } from "npm:dji-log-parser-js@0.5.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const djiApiKey = Deno.env.get("DJI_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { mission_id } = await req.json();
    if (!mission_id) {
      return jsonResponse({ error: "mission_id em falta" }, 400);
    }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("*")
      .eq("id", mission_id)
      .single();

    if (missionError || !mission) {
      return jsonResponse({ error: "Missão não encontrada" }, 404);
    }

    if (!mission.log_file_url) {
      return jsonResponse({ error: "Missão sem log associado" }, 400);
    }

    await supabase
      .from("missions")
      .update({ log_status: "a_processar", log_error: null })
      .eq("id", mission_id);

    // 1. Descarregar o ficheiro do bucket privado "logs"
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("logs")
      .download(mission.log_file_url);

    if (downloadError || !fileBlob) {
      throw new Error(`Não foi possível descarregar o log: ${downloadError?.message}`);
    }

    const buffer = new Uint8Array(await fileBlob.arrayBuffer());

    // 2. Inicializar o parser e decifrar
    const parser = new DJILog(buffer);
    let keychains = undefined;

    if (parser.version >= 13) {
      if (!djiApiKey) {
        throw new Error(
          "Log encriptado (versão 13+) mas o segredo DJI_API_KEY não está configurado."
        );
      }
      keychains = await parser.fetchKeychains(djiApiKey);
    }

    const frames = parser.frames(keychains);
    const details = parser.details ?? {};

    // 3. Extrair métricas — ver nota no topo do ficheiro sobre nomes de campos
    const flightSeconds = normalizeTime(details.totalTime);
    const distanceMeters = details.totalDistance ?? null;
    const maxAltitudeMeters = details.maxHeight ?? null;
    const maxSpeedMps = details.maxHorizontalSpeed ?? null;

    // Tentar identificar o nº de série da bateria a partir dos frames
    const batterySerial = findBatterySerial(frames);

    // 4. Tentar associar a uma bateria já registada, pelo nº de série
    let batteryId = mission.battery_id;
    if (!batteryId && batterySerial) {
      const { data: matchedBattery } = await supabase
        .from("batteries")
        .select("id, cycle_count, total_flight_seconds")
        .eq("serial_number", batterySerial)
        .maybeSingle();
      if (matchedBattery) {
        batteryId = matchedBattery.id;
        await supabase
          .from("batteries")
          .update({
            cycle_count: (matchedBattery.cycle_count ?? 0) + 1,
            total_flight_seconds: (matchedBattery.total_flight_seconds ?? 0) + (flightSeconds ?? 0),
          })
          .eq("id", matchedBattery.id);
      }
    }

    // 5. Atualizar horas de voo do drone
    if (mission.drone_id && flightSeconds) {
      const { data: drone } = await supabase
        .from("drones")
        .select("total_flight_seconds")
        .eq("id", mission.drone_id)
        .single();
      if (drone) {
        await supabase
          .from("drones")
          .update({ total_flight_seconds: (drone.total_flight_seconds ?? 0) + flightSeconds })
          .eq("id", mission.drone_id);
      }
    }

    // 6. Atualizar a missão
    await supabase
      .from("missions")
      .update({
        origin: "log_importado",
        log_processed: true,
        log_status: "concluido",
        log_error: null,
        flight_seconds: flightSeconds,
        distance_meters: distanceMeters,
        max_altitude_meters: maxAltitudeMeters,
        max_speed_mps: maxSpeedMps,
        battery_id: batteryId,
        battery_serial_seen: batterySerial,
      })
      .eq("id", mission_id);

    return jsonResponse({
      ok: true,
      flight_seconds: flightSeconds,
      distance_meters: distanceMeters,
      max_altitude_meters: maxAltitudeMeters,
      battery_serial_seen: batterySerial,
    });
  } catch (err) {
    console.error(err);
    // tenta registar o erro na missão, se já soubermos o id
    try {
      const body = await req.clone().json();
      if (body?.mission_id) {
        await supabase
          .from("missions")
          .update({ log_status: "erro", log_error: String(err?.message ?? err) })
          .eq("id", body.mission_id);
      }
    } catch (_) {
      // ignora — já estamos no caminho de erro
    }
    return jsonResponse({ error: String(err?.message ?? err) }, 500);
  }
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// O totalTime documentado por algumas versões do formato DJI vem em décimos
// de segundo, não em segundos. Heurística: se o valor for muito grande para
// ser segundos de um voo normal (>3h), assume-se décimos de segundo.
function normalizeTime(rawTotalTime) {
  if (rawTotalTime == null) return null;
  return rawTotalTime > 10800 ? Math.round(rawTotalTime / 10) : Math.round(rawTotalTime);
}

// Percorre os frames à procura de um campo com o nº de série da bateria.
// A biblioteca normaliza frames de formatos diferentes, por isso os nomes
// de campo podem variar — tenta os mais prováveis e devolve null se não
// encontrar nada.
function findBatterySerial(frames) {
  if (!Array.isArray(frames)) return null;
  for (const frame of frames) {
    const serial =
      frame?.batteryInfo?.serialNumber ??
      frame?.battery?.serialNumber ??
      frame?.smartBattery?.serialNumber ??
      null;
    if (serial) return serial;
  }
  return null;
}
