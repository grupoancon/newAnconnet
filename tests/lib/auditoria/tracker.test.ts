import { beforeEach, describe, expect, it, vi } from "vitest"

const enviar = vi.fn()
vi.mock("@/lib/api/auditoria-api", () => ({ enviarEventosWeb: (...a: unknown[]) => enviar(...a) }))

// El módulo guarda la cola en variables de módulo: se reimporta limpio en cada test.
async function cargarTracker() {
  vi.resetModules()
  return import("@/lib/auditoria/tracker")
}

describe("tracker de auditoría", () => {
  beforeEach(() => {
    enviar.mockReset()
  })

  it("envía lo encolado y vacía la cola", async () => {
    enviar.mockResolvedValue({ recibidos: 2, guardados: 2 })
    const t = await cargarTracker()
    t.registrarEvento({ tipo: "PAGE_VIEW", ruta: "/a" })
    t.registrarEvento({ tipo: "CLICK", ruta: "/a", etiqueta: "Guardar" })

    await t.vaciarCola()
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toHaveLength(2)
    expect(enviar.mock.calls[0][0][0].ts).toEqual(expect.any(Number))

    await t.vaciarCola()
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it("parte en lotes de 50", async () => {
    enviar.mockResolvedValue({ recibidos: 50, guardados: 50 })
    const t = await cargarTracker()
    for (let i = 0; i < 120; i++) t.registrarEvento({ tipo: "CLICK", ruta: "/x" })

    await t.vaciarCola()
    expect(enviar.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20])
  })

  it("si el envío falla conserva los eventos para reintentar", async () => {
    enviar.mockRejectedValueOnce(new Error("caído")).mockResolvedValue({})
    const t = await cargarTracker()
    t.registrarEvento({ tipo: "PAGE_VIEW", ruta: "/a" })

    await t.vaciarCola()
    await t.vaciarCola()
    expect(enviar).toHaveBeenCalledTimes(2)
    expect(enviar.mock.calls[1][0]).toHaveLength(1)
  })

  it("en salida usa keepalive y manda un solo lote", async () => {
    enviar.mockResolvedValue({})
    const t = await cargarTracker()
    for (let i = 0; i < 70; i++) t.registrarEvento({ tipo: "CLICK", ruta: "/x" })

    await t.vaciarCola(true)
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][1]).toEqual({ keepalive: true })
  })

  it("registrarAccion encola un UI_ACTION con la ruta actual", async () => {
    enviar.mockResolvedValue({})
    const t = await cargarTracker()
    t.registrarAccion("DEPOSITO_APROBADO", "G-M4-31", { id: 7 })

    await t.vaciarCola()
    expect(enviar.mock.calls[0][0][0]).toMatchObject({
      tipo: "UI_ACTION",
      accion: "DEPOSITO_APROBADO",
      etiqueta: "G-M4-31",
      detalle: { id: 7 },
    })
  })
})
