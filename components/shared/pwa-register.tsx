"use client"

import { useEffect } from "react"

// Registra el service worker (public/sw.js). Solo en producción: en desarrollo un SW
// cacheando assets confunde más de lo que ayuda con el hot reload. Los navegadores
// además exigen HTTPS (o localhost) para registrarlo — en una IP de red local por http
// simplemente no se registra y la app sigue funcionando normal.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin SW la app funciona igual — solo se pierde la página offline.
    })
  }, [])

  return null
}
