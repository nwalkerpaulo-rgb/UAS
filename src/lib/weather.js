// Meteorologia via Open-Meteo — gratuito, sem API key, CORS aberto.
// https://open-meteo.com/

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

// Traduz um subconjunto do "weather code" da Open-Meteo para uma descrição em português.
// Tabela completa: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WEATHER_CODE_LABEL = {
  0: 'Céu limpo',
  1: 'Principalmente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Chuvisco fraco',
  53: 'Chuvisco moderado',
  55: 'Chuvisco forte',
  61: 'Chuva fraca',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve fraca',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Aguaceiros fracos',
  81: 'Aguaceiros moderados',
  82: 'Aguaceiros fortes',
  95: 'Trovoada',
}

export function weatherCodeLabel(code) {
  return WEATHER_CODE_LABEL[code] || 'Desconhecido'
}

// Converte um nome de local em coordenadas (primeiro resultado).
export async function geocodeLocation(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao procurar localização')
  const data = await res.json()
  const first = data?.results?.[0]
  if (!first) return null
  return { lat: first.latitude, lng: first.longitude, label: `${first.name}${first.admin1 ? ', ' + first.admin1 : ''}` }
}

// Devolve as condições meteorológicas atuais para umas coordenadas.
export async function fetchCurrentWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
    ].join(','),
    wind_speed_unit: 'ms',
    timezone: 'auto',
  })
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`)
  if (!res.ok) throw new Error('Falha ao obter meteorologia')
  const data = await res.json()
  const c = data.current
  if (!c) throw new Error('Sem dados meteorológicos disponíveis')

  return {
    fetchedAt: new Date().toISOString(),
    temperature_c: c.temperature_2m,
    humidity_pct: c.relative_humidity_2m,
    precipitation_mm: c.precipitation,
    weather_code: c.weather_code,
    weather_label: weatherCodeLabel(c.weather_code),
    cloud_cover_pct: c.cloud_cover,
    pressure_hpa: c.pressure_msl,
    wind_speed_ms: c.wind_speed_10m,
    wind_gusts_ms: c.wind_gusts_10m,
    wind_direction_deg: c.wind_direction_10m,
  }
}
