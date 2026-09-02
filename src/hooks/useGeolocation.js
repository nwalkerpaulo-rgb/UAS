import { useState } from 'react'

export function useGeolocation() {
  const [coords, setCoords] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState(null)

  function capture() {
    if (!('geolocation' in navigator)) {
      setStatus('error')
      setErrorMsg('Este dispositivo não suporta geolocalização.')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('ok')
      },
      (err) => {
        setStatus('error')
        setErrorMsg(
          err.code === 1
            ? 'Permissão de localização negada. Ativa-a nas definições do browser.'
            : 'Não foi possível obter a localização.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return { coords, status, errorMsg, capture }
}
