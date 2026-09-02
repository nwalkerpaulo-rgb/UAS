// scripts/import-excel.mjs
//
// Importa pilotos, habilitações e missões a partir do ficheiro Excel
// "GIOP_Capacidade_UAS_CUAS.xlsx" (folhas "Capacidade UAS-CUAS" e "Serviços").
//
// USO:
//   node scripts/import-excel.mjs caminho/para/ficheiro.xlsx --dry-run
//   node scripts/import-excel.mjs caminho/para/ficheiro.xlsx
//
// O --dry-run mostra tudo o que seria importado, sem escrever nada na base
// de dados. Corre sempre primeiro em --dry-run e confirma os avisos antes
// de correr a sério.
//
// Precisa de um ficheiro .env.import (não commitado) com:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (chave SERVICE ROLE, não a anon — Project Settings > API)

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.import' })

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')

if (!filePath) {
  console.error('Uso: node scripts/import-excel.mjs caminho/para/ficheiro.xlsx [--dry-run]')
  process.exit(1)
}

const EMAIL_DOMAIN = 'gnr.pt' // formato: g{NM}@gnr.pt

// ------------------------------------------------------------------
// Parsing de datas tolerante — o ficheiro tem datas em vários formatos
// e alguns erros de digitação (ex: "15/08/20226", "25-12-20027").
// Em vez de adivinhar, marca como aviso e deixa a data a null.
// ------------------------------------------------------------------
function parseFlexibleDate(raw) {
  if (raw == null || raw === '') return { iso: null, warning: null }
  if (raw instanceof Date && !isNaN(raw)) {
    return { iso: raw.toISOString().slice(0, 10), warning: null }
  }
  const str = String(raw).trim()
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d+)$/)
  if (match) {
    const [, d, m, yRaw] = match
    const day = Number(d)
    const month = Number(m)
    // só aceita ano com 2 ou 4 dígitos — nunca trunca um valor com dígitos a mais
    if (yRaw.length !== 2 && yRaw.length !== 4) {
      return { iso: null, warning: `Ano inválido em "${str}" (${yRaw.length} dígitos)` }
    }
    const year = yRaw.length === 4 ? Number(yRaw) : 2000 + Number(yRaw)
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { iso, warning: null }
    }
  }
  return { iso: null, warning: `Data não reconhecida: "${str}"` }
}

function normalizeNm(raw) {
  if (raw == null) return null
  if (typeof raw === 'number') return String(Math.trunc(raw))
  return String(raw).trim()
}

function isChecked(cell) {
  return typeof cell === 'string' && cell.trim() === '☑'
}

// ------------------------------------------------------------------
// 1. Ler o Excel
// ------------------------------------------------------------------
const workbook = XLSX.readFile(filePath, { cellDates: true })

const capSheet = workbook.Sheets['Capacidade UAS-CUAS']
const servSheet = workbook.Sheets['Serviços']

if (!capSheet || !servSheet) {
  console.error('Não encontrei as folhas "Capacidade UAS-CUAS" e/ou "Serviços" no ficheiro.')
  process.exit(1)
}

const capRows = XLSX.utils.sheet_to_json(capSheet, { header: 1, range: 3, defval: null }) // começa após o cabeçalho (linha 3)
const servRows = XLSX.utils.sheet_to_json(servSheet, { header: 1, range: 3, defval: null }) // começa após o cabeçalho (linha 4)

// ------------------------------------------------------------------
// 2. Pessoas + habilitações
// ------------------------------------------------------------------
const people = []
const certifications = []
const warnings = []
const seenNm = new Set()

for (const row of capRows) {
  const [areaFuncional, subunidade, pelotao, posto, nmRaw, fullName, , phoneRaw, cprant, cursoCuas, a1, a2, a3, certNumber, validade, obs] = row

  if (!nmRaw || !fullName) continue // linha vazia ou incompleta

  const nm = normalizeNm(nmRaw)
  if (seenNm.has(nm)) {
    warnings.push(`NM duplicado na folha Capacidade: ${nm} (${fullName})`)
    continue
  }
  seenNm.add(nm)

  const phone = phoneRaw ? String(phoneRaw).trim() : null
  const email = `g${nm}@${EMAIL_DOMAIN}`

  people.push({
    nm,
    full_name: String(fullName).trim(),
    email,
    phone,
    posto: posto ? String(posto).trim() : null,
    subunidade: subunidade ? String(subunidade).trim() : null,
    pelotao: pelotao && pelotao !== '—' ? String(pelotao).trim() : null,
    area_funcional: areaFuncional ? String(areaFuncional).trim() : null,
    notes: obs ? String(obs).trim() : null,
  })

  const { iso: expiresAt, warning: dateWarning } = parseFlexibleDate(validade)
  if (dateWarning) warnings.push(`${fullName} (NM ${nm}): ${dateWarning}`)

  const quals = [
    [cprant, 'CPRANT / Curso UAS'],
    [cursoCuas, 'Curso C-UAS'],
    [a1, 'A1'],
    [a2, 'A2'],
    [a3, 'A3'],
  ]
  for (const [checked, type] of quals) {
    if (isChecked(checked)) {
      certifications.push({
        nm,
        type,
        certificate_number: certNumber ? String(certNumber).trim() : null,
        expires_at: expiresAt,
      })
    }
  }
}

// ------------------------------------------------------------------
// 3. Missões (folha Serviços)
// ------------------------------------------------------------------
const missions = []

for (const row of servRows) {
  const [dataRaw, nmRaw, nome, , , tipoServico, uasUsado, categoria, notam, local, obs] = row

  if (!nmRaw) continue // linha vazia ou nota final da folha
  const nm = normalizeNm(nmRaw)
  if (!seenNm.has(nm)) {
    warnings.push(`Missão ignorada: NM ${nm} (${nome || '?'}) não existe na folha Capacidade`)
    continue
  }

  const { iso: startedAt, warning: dateWarning } = parseFlexibleDate(dataRaw)
  if (dateWarning) warnings.push(`Missão de ${nome} em "${local}": ${dateWarning}`)

  missions.push({
    nm,
    started_at: startedAt,
    tipo_servico: tipoServico ? String(tipoServico).trim() : null,
    category: categoria ? String(categoria).trim() : null,
    notam_number: notam ? String(notam).trim() : null,
    uas_used_label: uasUsado ? String(uasUsado).trim() : null,
    area_label: local ? String(local).trim() : null,
    notes: obs ? String(obs).trim() : null,
  })
}

// ------------------------------------------------------------------
// 4. Resumo
// ------------------------------------------------------------------
console.log('\n=== RESUMO DA IMPORTAÇÃO ===')
console.log(`Pessoas:        ${people.length}`)
console.log(`Habilitações:   ${certifications.length}`)
console.log(`Missões:        ${missions.length}`)
console.log(`Avisos:         ${warnings.length}`)

if (warnings.length > 0) {
  console.log('\n--- Avisos (revê antes de confiar 100% nestes dados) ---')
  for (const w of warnings) console.log('  ⚠ ' + w)
}

if (dryRun) {
  console.log('\n(--dry-run: nada foi escrito na base de dados)')
  console.log('\nExemplo de pessoa a importar:', people[0])
  console.log('Exemplo de missão a importar:', missions.find((m) => m.started_at))
  process.exit(0)
}

// ------------------------------------------------------------------
// 5. Escrita na base de dados
// ------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\nFaltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ficheiro .env.import')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function generatePassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x')
}

const credentials = []

console.log('\nA importar...\n')

for (const person of people) {
  // já existe? (idempotente — corre o script mais que uma vez sem duplicar)
  const { data: existing } = await supabase.from('profiles').select('id').eq('nm', person.nm).maybeSingle()

  let profileId = existing?.id

  if (!profileId) {
    const password = generatePassword()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: person.email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error(`  ✗ ${person.full_name} (${person.email}): ${authError.message}`)
      continue
    }

    profileId = authUser.user.id
    credentials.push({ nm: person.nm, full_name: person.full_name, email: person.email, password })

    const { error: profileError } = await supabase.from('profiles').insert({
      id: profileId,
      full_name: person.full_name,
      email: person.email,
      phone: person.phone,
      role: 'piloto',
      nm: person.nm,
      posto: person.posto,
      subunidade: person.subunidade,
      pelotao: person.pelotao,
      area_funcional: person.area_funcional,
    })

    if (profileError) {
      console.error(`  ✗ perfil de ${person.full_name}: ${profileError.message}`)
      continue
    }
    console.log(`  ✓ ${person.full_name} (${person.email})`)
  } else {
    console.log(`  · ${person.full_name} já existia, a saltar criação de conta`)
  }

  // habilitações desta pessoa
  const personCerts = certifications.filter((c) => c.nm === person.nm)
  for (const cert of personCerts) {
    const { data: existingCert } = await supabase
      .from('certifications')
      .select('id')
      .eq('profile_id', profileId)
      .eq('type', cert.type)
      .maybeSingle()
    if (existingCert) continue
    await supabase.from('certifications').insert({
      profile_id: profileId,
      type: cert.type,
      certificate_number: cert.certificate_number,
      expires_at: cert.expires_at,
    })
  }
}

// segunda passagem: missões (precisa de todos os profile_id já resolvidos)
const { data: allProfiles } = await supabase.from('profiles').select('id, nm')
const profileByNm = Object.fromEntries((allProfiles || []).map((p) => [p.nm, p.id]))

let missionsInserted = 0
for (const mission of missions) {
  const pilotId = profileByNm[mission.nm]
  if (!pilotId) continue

  // evita duplicar se o script correr outra vez
  const { data: existingMission } = await supabase
    .from('missions')
    .select('id')
    .eq('pilot_id', pilotId)
    .eq('started_at', mission.started_at)
    .eq('area_label', mission.area_label)
    .maybeSingle()
  if (existingMission) continue

  const { error } = await supabase.from('missions').insert({
    pilot_id: pilotId,
    origin: 'manual',
    status: 'concluida',
    started_at: mission.started_at,
    tipo_servico: mission.tipo_servico,
    category: mission.category,
    notam_number: mission.notam_number,
    uas_used_label: mission.uas_used_label,
    area_label: mission.area_label,
    notes: mission.notes,
  })
  if (!error) missionsInserted++
}

console.log(`\nMissões importadas: ${missionsInserted}/${missions.length}`)

// ------------------------------------------------------------------
// 6. Guardar credenciais geradas (contas novas apenas)
// ------------------------------------------------------------------
if (credentials.length > 0) {
  const outDir = path.resolve('scripts/output')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `credenciais_${Date.now()}.csv`)
  const csv = ['nm,nome,email,password', ...credentials.map((c) => `${c.nm},"${c.full_name}",${c.email},${c.password}`)].join('\n')
  fs.writeFileSync(outPath, csv)
  console.log(`\n${credentials.length} contas novas criadas. Credenciais guardadas em: ${outPath}`)
  console.log('Este ficheiro NÃO vai para o Git (está no .gitignore) — trata-o como confidencial.')
}

console.log('\nConcluído.')
