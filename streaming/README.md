# Streaming — Operações ao Vivo

Arquitetura para os dois feeds de vídeo (drone e C-UAS) dentro da app, ambos
autenticados com a mesma sessão Supabase.

```
DJI Pilot 2 (RTMP) ---\
                        \
                         >-- MediaMTX --(HLS autenticado)--> App (browser)
                        /
cuas-capture (RTMP) ---/
     |
     v
 192.168.1.10:7001  (página web do sistema C-UAS)
```

## ⚠️ Ponto crítico de rede

O `cuas-capture` **tem de correr numa máquina que consiga aceder a
`192.168.1.10:7001`** — ou seja, na mesma rede local do sistema C-UAS.

Duas formas de organizar isto:

**Cenário A — Tudo na rede local da unidade**
MediaMTX e cuas-capture correm ambos numa máquina dentro da mesma rede do
C-UAS. Depois, expõe-se só a porta do MediaMTX (1935 para RTMP, 8888 para
HLS) à internet — via port-forward no router, ou mais seguro, via túnel
(Cloudflare Tunnel, Tailscale Funnel) para não teres de abrir portas.

**Cenário B — MediaMTX num VPS, cuas-capture na rede local**
O MediaMTX fica num servidor público (VPS pequeno, acessível de qualquer
lado). O cuas-capture continua a correr numa máquina dentro da rede do
C-UAS, mas em vez de enviar para `rtmp://mediamtx:1935/...` (endereço
interno do Docker Compose), envia para o IP/domínio público do VPS:
`rtmp://o-teu-vps.exemplo.com:1935/cuas1`. O drone (Pilot 2) faz o mesmo.

O Cenário A é mais simples de montar se já tiveres uma máquina fixa na
rede da unidade. O Cenário B é mais robusto se a equipa opera em vários
locais diferentes (o VPS é sempre o mesmo ponto de encontro).

## Passos de instalação

### 1. Publicar a Edge Function de autenticação

```bash
supabase functions deploy verify-stream-auth
```

Não precisa de segredos extra — usa `SUPABASE_URL` e `SUPABASE_ANON_KEY`,
que o Supabase já injeta automaticamente.

### 2. Configurar o `mediamtx.yml`

Edita `authHTTPAddress` com o URL real da tua função (aparece no terminal
depois do deploy, ou em Edge Functions no dashboard Supabase).

### 3. Ajustar o `docker-compose.yml`

Confirma o `CUAS_URL` (o endereço real do teu sistema C-UAS).

### 4. Arrancar

Na máquina escolhida (ver "Ponto crítico de rede" acima):

```bash
cd streaming
docker compose up -d
```

Confirma que está tudo a correr:

```bash
docker compose logs -f
```

### 5. Configurar o DJI Pilot 2

No comando/RC, abre o Pilot 2 → transmissão em direto → **Custom RTMP** →
mete `rtmp://<endereço-do-mediamtx>:1935/drone1`.

### 6. Testar sem a app primeiro

Com o VLC ou ffplay, confirma que os streams chegam:

```bash
ffplay rtmp://<endereço-do-mediamtx>:1935/cuas1
```

(Sem autenticação neste teste direto por RTMP — a autenticação aplica-se
à *leitura* via HLS, que é o que a app usa.)

## Notas de custo

- MediaMTX, ffmpeg, Chromium, Xvfb — tudo grátis e open-source
- O único custo real é a máquina onde isto corre. Se já tiveres um
  servidor/computador disponível na unidade (Cenário A), custo zero. Se
  precisares de um VPS (Cenário B), os mais baratos rondam poucos euros/mês
  — não precisa de ser potente, isto usa pouca CPU
