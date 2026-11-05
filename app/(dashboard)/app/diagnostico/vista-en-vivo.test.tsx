import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { describirAccion, esAccionConProblema } from "./en-vivo"
import { VistaEnVivo } from "./vista-en-vivo"

const obtenerSesionesEnVivo = vi.fn()
const obtenerAccionesEnVivo = vi.fn()

vi.mock("@/lib/api/telemetria-api", () => ({
  obtenerSesionesEnVivo: () => obtenerSesionesEnVivo(),
  obtenerAccionesEnVivo: (session: string) => obtenerAccionesEnVivo(session),
  TelemetriaApiError: class extends Error {},
}))

const sesion = {
  session: "s1",
  userId: "0900000000",
  userEmail: "cliente@correo.com",
  platform: "ios",
  appVersion: "1.2.4",
  deviceModel: "iPhone",
  screen: "/tabs/payments",
  state: "active",
  errors: 2,
  lastError: "HTTP 500: GET http://api.x.com/depositoss/cedula/:numero",
  lastSeen: new Date().toISOString(),
  lastAction: { message: "ui_click", level: "event", props: { text: "Realizar pago" } },
}

describe("VistaEnVivo", () => {
  beforeEach(() => {
    obtenerSesionesEnVivo.mockReset()
    obtenerAccionesEnVivo.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it("muestra usuario, pantalla, última acción y errores", async () => {
    obtenerSesionesEnVivo.mockResolvedValue([sesion])
    render(<VistaEnVivo />)
    expect(await screen.findByText("cliente@correo.com")).toBeTruthy()
    expect(screen.getByText(/\/tabs\/payments · Tocó "Realizar pago"/)).toBeTruthy()
    expect(screen.getByText("2 errores")).toBeTruthy()
    expect(screen.getByText("1 sesión activa")).toBeTruthy()
    expect(screen.getByText("Último error: HTTP 500: GET /depositoss/cedula/:numero")).toBeTruthy()
  })

  it("abre las acciones de la sesión y marca la petición fallida", async () => {
    obtenerSesionesEnVivo.mockResolvedValue([sesion])
    obtenerAccionesEnVivo.mockResolvedValue([
      {
        id: "a",
        message: "http_request",
        level: "event",
        screen: "/tabs/payments",
        statusCode: null,
        time: Date.now(),
        props: { httpMethod: "GET", url: "http://api.x.com/depositoss/cedula/:numero", status: 500, durationMs: 80 },
      },
    ])
    render(<VistaEnVivo />)
    fireEvent.click(await screen.findByText("cliente@correo.com"))
    const fila = await screen.findByText("GET /depositoss/cedula/:numero → 500 · 80 ms")
    expect(fila.className).toContain("text-destructive")
    expect(obtenerAccionesEnVivo).toHaveBeenCalledWith("s1")
  })

  it("indica cuando no hay sesiones", async () => {
    obtenerSesionesEnVivo.mockResolvedValue([])
    render(<VistaEnVivo />)
    expect(await screen.findByText("No hay nadie usando la app")).toBeTruthy()
  })

  it("muestra el error si la primera consulta falla", async () => {
    obtenerSesionesEnVivo.mockRejectedValue(new Error("x"))
    render(<VistaEnVivo />)
    expect(await screen.findByText("No se pudo cargar el monitoreo")).toBeTruthy()
  })
})

describe("describirAccion", () => {
  const accion = (message: string, props: Record<string, unknown>, level = "event") => ({
    message,
    level,
    props,
  })

  it("describe cada tipo de evento", () => {
    expect(describirAccion(accion("screen_view", { path: "/tabs/home" }))).toBe("Abrió /tabs/home")
    expect(describirAccion(accion("ui_click", { text: "Pagar", x: 50, y: 20 }))).toBe('Tocó "Pagar" (50%, 20%)')
    expect(describirAccion(accion("ui_click", { element: "div.faq-trigger" }))).toBe("Tocó div.faq-trigger")
    expect(describirAccion(accion("field_change", { field: "monto" }))).toBe("Cambió el campo monto")
    expect(describirAccion(accion("http_request", { httpMethod: "GET", url: "/x", status: 0, durationMs: 9 }))).toBe(
      "GET /x → sin respuesta · 9 ms",
    )
    expect(describirAccion(accion("HTTP 500: GET /x", {}, "error"))).toBe("HTTP 500: GET /x")
  })

  it("distingue los problemas", () => {
    expect(esAccionConProblema(accion("http_request", { status: 200 }))).toBe(false)
    expect(esAccionConProblema(accion("http_request", { status: 404 }))).toBe(true)
    expect(esAccionConProblema(accion("http_request", { status: 0 }))).toBe(true)
    expect(esAccionConProblema(accion("cualquiera", {}, "error"))).toBe(true)
  })
})
