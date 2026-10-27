"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  listarClientesExtra,
  obtenerRefinanciamientoPorId,
  obtenerOferta,
  obtenerProceso,
  type ClienteExtraBackend,
  type CuotaAmortizacion,
  type EntradaPago,
  type RefinanciamientoBackend,
  type OfertaBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"
import {
  listarRepresentantesActivos,
  type RepresentanteConvenio,
} from "@/lib/api/convenios-api"

// Mismo patrón que oferta-imprimir-content.tsx: un firmante extra de cliente (cónyuge,
// apoderado, referido, cliente adicional, o nombre libre) — no de la empresa, esa va
// aparte en "representanteEmpresa".
type Firmante = { id: string; nombre: string; rol: string }

// Mismo formato que el anexo legacy (anconet.ancongroups.com/ventas/process/refinanciamiento):
// numero con separador de miles y 2 decimales, SIN simbolo de moneda — el "$" solo
// aparece, literal, en la linea "Saldo a financiar".
function formatearNumero(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// "Crédito BIESS (Sin Interés)" (solo en Refinanciamiento) sigue las mismas reglas
// que "Crédito BIESS" — sin esto, un chequeo literal `!== "Crédito BIESS"` deja pasar
// el tipo nuevo como si tuviera cronograma, cuando en realidad tampoco lo tiene
// (mismo criterio que esBiessLike en refinanciamiento-content.tsx).
function esBiessLike(tipo: string | null | undefined): boolean {
  return tipo === "Crédito BIESS" || tipo === "Crédito BIESS (Sin Interés)"
}

export function RefinanciamientoImprimirContent({ id }: { id: string }) {
  const router = useRouter()
  // `id` es el id DEL REFINANCIAMIENTO (no del proceso) — mismo criterio que
  // refinanciamiento-reporte-content.tsx.
  const idNumero = Number(id)
  const puedeAprobar = useCan("refinanciamiento:aprobar")

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [refinanciamiento, setRefinanciamiento] =
    useState<RefinanciamientoBackend | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [oferta, setOferta] = useState<OfertaBackend | null>(null)
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraBackend[]>([])

  // Firmas — mismo patrón que oferta-imprimir-content.tsx: el cliente es fijo (viene
  // del proceso), el representante de la empresa se elige de una lista (la misma que el
  // convenio: Configuración > Convenios > Representantes, ver
  // listarRepresentantesActivos); se pueden agregar más
  // firmantes de CLIENTE desde los candidatos ya registrados (cónyuge, apoderado,
  // referido, clientes extra — todos vienen de la oferta del mismo proceso) o con
  // nombre libre. Todo esto es solo para esta impresión, no se guarda, y solo aplica
  // una vez aprobado (un borrador no se firma).
  const [representantesDisponibles, setRepresentantesDisponibles] = useState<
    RepresentanteConvenio[]
  >([])
  const [representanteEmpresa, setRepresentanteEmpresa] = useState("")
  const [firmantesExtra, setFirmantesExtra] = useState<Firmante[]>([])

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Refinanciamiento inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const refinanciamientoData = await obtenerRefinanciamientoPorId(idNumero)
        if (cancelado) return
        if (!refinanciamientoData) {
          setError("No se encontró el refinanciamiento.")
          return
        }
        setRefinanciamiento(refinanciamientoData)

        const procesoData = await obtenerProceso(refinanciamientoData.id_process)
        if (cancelado) return
        if (!procesoData) {
          setError("No se encontró el proceso del lote.")
          return
        }
        setProceso(procesoData)

        const [lote, ofertaData, extra, representantes] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerOferta(refinanciamientoData.id_process),
          listarClientesExtra(refinanciamientoData.id_process),
          listarRepresentantesActivos(),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setOferta(ofertaData)
        setClientesExtra(extra)
        setRepresentantesDisponibles(representantes)
        // Igual que el convenio: arranca con el primer representante activo.
        setRepresentanteEmpresa((actual) => actual || representantes[0]?.nombre || "")
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError || err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [idNumero])

  const titular = proceso?.titular ?? null
  // Con apoderado cargado en la oferta, firma él en lugar del cliente principal (mismo
  // criterio que el convenio); el titular queda como candidato para agregarlo aparte.
  const apoderado = oferta?.cli_representante?.trim() || null
  const valorLote = loteInfo?.pvp ?? proceso?.lote_price ?? null
  const valorLoteNumero =
    typeof valorLote === "string" ? parseFloat(valorLote) : (valorLote ?? 0)
  const entradas = refinanciamiento?.entradas ?? []
  const cronograma = refinanciamiento?.detalle ?? []
  const comentarios = (refinanciamiento?.comentarios ?? []).filter(
    (c) => c && c.trim().length > 0
  )

  const totalesEntrada = entradas.reduce(
    (acc, fila) => ({
      abono: acc.abono + (Number(fila.abono_lote ?? fila.monto) || 0),
      alicuota: acc.alicuota + (Number(fila.alicuota_comunal) || 0),
      escritura: acc.escritura + (Number(fila.escritura) || 0),
      total: acc.total + (Number(fila.total_cancelar) || 0),
    }),
    { abono: 0, alicuota: 0, escritura: 0, total: 0 }
  )

  const totalesCronograma = cronograma.reduce(
    (acc, fila) => ({
      capital: acc.capital + fila.capital,
      interes: acc.interes + fila.interes,
      abono: acc.abono + fila.abono,
      alicuota: acc.alicuota + fila.alicuota,
      escritura: acc.escritura + fila.escritura,
    }),
    { capital: 0, interes: 0, abono: 0, alicuota: 0, escritura: 0 }
  )

  // Columnas de alícuota (una por componente con nombre propio, ej. Perla Verde tiene
  // 2) — de la primera fila que las tenga; si el refinanciamiento se guardó antes de
  // este cambio (sin `alicuotas`), se muestra 1 sola columna genérica con el escalar
  // legado. Misma lógica para la tabla de entrada y la de cronograma.
  const columnasAlicuotaEntrada = (() => {
    const conComponentes = entradas.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return entradas.length > 0 ? ["Alicuota"] : []
  })()

  function alicuotasDeFilaEntrada(fila: EntradaPago): number[] {
    return fila.alicuotas?.length
      ? fila.alicuotas.map((c) => c.valor)
      : [fila.alicuota_comunal]
  }

  const alicuotaTotalPorColumnaEntrada = columnasAlicuotaEntrada.map((_, indice) =>
    entradas.reduce((acc, fila) => acc + (alicuotasDeFilaEntrada(fila)[indice] ?? 0), 0)
  )

  const columnasAlicuotaCronograma = (() => {
    const conComponentes = cronograma.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return cronograma.length > 0 ? ["Alicuota"] : []
  })()

  function alicuotasDeFilaCronograma(fila: CuotaAmortizacion): number[] {
    return fila.alicuotas?.length ? fila.alicuotas.map((c) => c.valor) : [fila.alicuota]
  }

  const alicuotaTotalPorColumnaCronograma = columnasAlicuotaCronograma.map((_, indice) =>
    cronograma.reduce(
      (acc, fila) => acc + (alicuotasDeFilaCronograma(fila)[indice] ?? 0),
      0
    )
  )

  const saldoAFinanciar =
    totalesCronograma.capital || Number(refinanciamiento?.total_financ ?? 0)
  // "Contado"/"Crédito BIESS" siempre llevan un descuento fijo (5%/3%, misma regla que
  // new/[id]) — si el registro quedó guardado sin el campo "discount", se recalcula
  // igual para mostrarlo.
  const descuentoTipo =
    Number(refinanciamiento?.discount) ||
    (refinanciamiento?.financ_type === "Contado"
      ? valorLoteNumero * 0.05
      : esBiessLike(refinanciamiento?.financ_type)
        ? valorLoteNumero * 0.03
        : 0)
  // "DESCUENTO" en el anexo muestra el descuento por tipo de refinanciamiento + el
  // descuento extra juntos en una sola línea — la promoción se muestra aparte, ya que
  // va identificada por su propio nombre.
  const descuentoConDescuentoExtra =
    descuentoTipo + (Number(refinanciamiento?.extra_discount) || 0)
  // Se puede imprimir desde "ingresado" en adelante (refinanciamiento.status —
  // a diferencia de financiamiento-imprimir-content.tsx, acá no hay
  // proceso.finan_status del que leerlo, es directo) — antes de aprobar, el anexo
  // sale marcado como BORRADOR (ver más abajo) para que no se confunda con la versión
  // firmable. Solo si el usuario tiene el permiso "refinanciamiento:aprobar" — mismo
  // criterio que habilita el botón Imprimir en el reporte. Bloqueado acá también para
  // que entrar directo por la URL no lo salte.
  const estadoRefinanciamiento = (refinanciamiento?.status ?? "").trim().toLowerCase()
  const aprobado = estadoRefinanciamiento === "aprobado"
  const listoParaImprimir = aprobado || estadoRefinanciamiento === "ingresado"
  const puedeImprimir = listoParaImprimir && puedeAprobar

  // Candidatos disponibles para agregar como firmantes extra — solo los que tienen
  // nombre cargado (vienen de la oferta del mismo proceso, no de refinanciamiento).
  // "tipo" evita agregarlos dos veces.
  const candidatos = useMemo(() => {
    if (!oferta) return []
    const lista: Array<{ tipo: string; nombre: string; rolSugerido: string }> = []
    if (oferta.cli_conyuName) {
      lista.push({
        tipo: "conyuge",
        nombre: oferta.cli_conyuName,
        rolSugerido: "Cónyuge",
      })
    }
    // Con apoderado, él ya firma como cliente (ver `apoderado`): el que queda para
    // agregar aparte, si también tiene que firmar, es el titular.
    if (apoderado && titular?.nombre) {
      lista.push({
        tipo: "titular",
        nombre: titular.nombre,
        rolSugerido: "C.C N°",
      })
    }
    if (oferta.referido_nombre) {
      lista.push({
        tipo: "referido",
        nombre: oferta.referido_nombre,
        rolSugerido: "Referido",
      })
    }
    clientesExtra.forEach((cliente, indice) => {
      if (cliente.nombre) {
        lista.push({
          tipo: `extra_${indice}`,
          nombre: cliente.nombre,
          rolSugerido: "Cliente adicional",
        })
      }
    })
    return lista.filter((c) => !firmantesExtra.some((f) => f.id === c.tipo))
  }, [oferta, clientesExtra, firmantesExtra, apoderado, titular])

  function agregarFirmante(candidato: {
    tipo: string
    nombre: string
    rolSugerido: string
  }) {
    setFirmantesExtra((anterior) => [
      ...anterior,
      { id: candidato.tipo, nombre: candidato.nombre, rol: candidato.rolSugerido },
    ])
  }

  function agregarFirmanteLibre() {
    setFirmantesExtra((anterior) => [
      ...anterior,
      { id: `libre_${Date.now()}`, nombre: "", rol: "" },
    ])
  }

  function actualizarFirmanteExtra(id: string, campo: "nombre" | "rol", valor: string) {
    setFirmantesExtra((anterior) =>
      anterior.map((firmante) =>
        firmante.id === id ? { ...firmante, [campo]: valor } : firmante
      )
    )
  }

  function quitarFirmanteExtra(id: string) {
    setFirmantesExtra((anterior) => anterior.filter((firmante) => firmante.id !== id))
  }

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <div className="no-print border-border bg-card sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          Volver
        </Button>
        {refinanciamiento && puedeImprimir && (
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" strokeWidth={1.8} />
            Imprimir
          </Button>
        )}
      </div>

      {cargando ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner />
        </div>
      ) : error || !refinanciamiento ? (
        <div className="p-8">
          <EmptyState
            title="No se puede abrir el reporte"
            description={error ?? "No se encontró el refinanciamiento."}
            dashed
          />
        </div>
      ) : !listoParaImprimir ? (
        <div className="p-8">
          <EmptyState
            title="Este refinanciamiento todavía no está listo para imprimir"
            description="El anexo se puede imprimir una vez que el refinanciamiento fue guardado como ingresado (sale marcado como BORRADOR hasta que se apruebe)."
            dashed
          />
        </div>
      ) : !puedeAprobar ? (
        <div className="p-8">
          <EmptyState
            title="No tienes permiso para imprimir este anexo"
            description="Solo quienes pueden aprobar refinanciamientos pueden imprimir el anexo."
            dashed
          />
        </div>
      ) : (
        <>
          {aprobado && (
            <div className="no-print border-border bg-card mx-auto mt-6 w-full max-w-[860px] rounded-md border p-4">
              <div className="mb-2 text-sm font-semibold">
                Representante de la empresa (firma)
              </div>
              <SelectField
                placeholder="Seleccione quién firma por la empresa"
                options={representantesDisponibles.map((persona) => persona.nombre)}
                value={representanteEmpresa}
                onValueChange={setRepresentanteEmpresa}
              />

              <div className="border-border mt-4 border-t pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    Firmantes adicionales (clientes)
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={agregarFirmanteLibre}
                  >
                    <Plus className="size-3.5" strokeWidth={1.8} />
                    Agregar nombre libre
                  </Button>
                </div>
                {candidatos.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {candidatos.map((candidato) => (
                      <Button
                        key={candidato.tipo}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => agregarFirmante(candidato)}
                      >
                        <Plus className="size-3.5" strokeWidth={1.8} />
                        {candidato.nombre} ({candidato.rolSugerido})
                      </Button>
                    ))}
                  </div>
                )}
                {firmantesExtra.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {firmantesExtra.map((firmante) => (
                      <div key={firmante.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Nombre"
                          value={firmante.nombre}
                          onChange={(e) =>
                            actualizarFirmanteExtra(firmante.id, "nombre", e.target.value)
                          }
                        />
                        <Input
                          placeholder="Rol (ej. Cónyuge)"
                          value={firmante.rol}
                          onChange={(e) =>
                            actualizarFirmanteExtra(firmante.id, "rol", e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar firmante"
                          onClick={() => quitarFirmanteExtra(firmante.id)}
                        >
                          <Trash2 className="text-destructive size-4" strokeWidth={1.8} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="anexo-imprimible relative mx-auto my-6 w-full max-w-[860px] bg-white p-10 text-black">
            {!aprobado && (
              <>
                {/* Marca de agua diagonal — se repite en cada hoja al imprimir (position:
                  fixed), para que el anexo de un refinanciamiento "ingresado" pero
                  todavía no aprobado no se confunda con la versión firmable. Visible
                  también en la vista previa de pantalla, no solo al imprimir. */}
                <div
                  aria-hidden
                  className="borrador-watermark pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
                >
                  <span className="-rotate-[35deg] text-[48px] font-black tracking-widest text-red-600/20 select-none">
                    BORRADOR
                  </span>
                </div>
                <div className="mb-5 rounded-md border-2 border-red-500 bg-red-50 p-3 text-center text-[11px] font-bold text-red-700">
                  BORRADOR — este refinanciamiento todavía no está aprobado.
                </div>
              </>
            )}
            <div className="mb-5 text-center">
              <div className="text-base font-bold">ANEXO</div>
              <div className="text-base font-bold">REFINANCIAMIENTO</div>
            </div>

            <div className="mb-5 rounded-md border border-gray-400 p-3 text-[11px]">
              <div className="mb-2">
                <span className="font-bold">CLIENTE: </span>
                {titular?.nombre ?? "—"}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <Campo
                  label="FECHA"
                  valor={refinanciamiento.created_at?.slice(0, 10) ?? "—"}
                />
                <Campo
                  label="TIPO DE REFINANCIAMIENTO"
                  valor={refinanciamiento.financ_type ?? "—"}
                />
                <Campo label="PROYECTO" valor={loteInfo?.proyecto?.nombre ?? "—"} />
                <Campo
                  label="INMUEBLE"
                  valor={loteInfo?.codigo ?? proceso?.cli_lote ?? "—"}
                />
                <Campo
                  label="VALOR DEL LOTE"
                  valor={formatearNumero(loteInfo?.pvp ?? proceso?.lote_price)}
                />
                <Campo
                  label="MTS"
                  valor={formatearNumero(loteInfo?.areaUtil ?? proceso?.lote_mts)}
                />
                <Campo
                  label="TOTAL A FINANCIAR"
                  valor={formatearNumero(saldoAFinanciar)}
                />
                {refinanciamiento.anual_interes && (
                  <Campo
                    label="TASA DE INTERÉS ANUAL"
                    valor={`${refinanciamiento.anual_interes}%`}
                  />
                )}
                {Number(refinanciamiento.adicionales) > 0 && (
                  <Campo
                    label="ADICIONALES"
                    valor={formatearNumero(refinanciamiento.adicionales)}
                  />
                )}
                {Number(refinanciamiento.abono_realizado) > 0 && (
                  <Campo
                    label="ABONO REALIZADO"
                    valor={formatearNumero(refinanciamiento.abono_realizado)}
                  />
                )}
                {Number(refinanciamiento.abono_capital) > 0 && (
                  <Campo
                    label="ABONO CAPITAL"
                    valor={formatearNumero(refinanciamiento.abono_capital)}
                  />
                )}
                {descuentoConDescuentoExtra > 0 && (
                  <Campo
                    label="DESCUENTO"
                    valor={formatearNumero(descuentoConDescuentoExtra)}
                  />
                )}
                {Number(refinanciamiento.promo_discount) > 0 && (
                  <Campo
                    label="DESCUENTO PROMOCIÓN"
                    valor={formatearNumero(refinanciamiento.promo_discount)}
                  />
                )}
                <Campo
                  label="OFRECIMIENTOS"
                  valor={refinanciamiento.ofrecimientos || "—"}
                />
              </div>
            </div>

            <table className="mb-2 w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <Th ancho="18%">Forma de Pago</Th>
                  <Th ancho="14%">Fecha de Pago</Th>
                  <Th ancho="14%">Abono Lote</Th>
                  {columnasAlicuotaEntrada.map((nombre, indice) => (
                    <Th key={indice}>{nombre}</Th>
                  ))}
                  <Th ancho="14%">Escritura</Th>
                  <Th ancho="14%">Total a Cancelar</Th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((fila, indice) => (
                  <tr key={indice}>
                    <Td>
                      {(refinanciamiento.financ_type === "Contado" ||
                        esBiessLike(refinanciamiento.financ_type)) &&
                      fila.forma_pago === "Entrada"
                        ? "Cuota"
                        : fila.forma_pago || fila.concepto || "—"}
                    </Td>
                    <Td>{formatearFecha(fila.fecha_pago || fila.fecha)}</Td>
                    <Td alinear="right">
                      {formatearNumero(fila.abono_lote ?? fila.monto)}
                    </Td>
                    {alicuotasDeFilaEntrada(fila).map((valor, indiceComponente) => (
                      <Td key={indiceComponente} alinear="right">
                        {valor ? formatearNumero(valor) : "-"}
                      </Td>
                    ))}
                    <Td alinear="right">
                      {fila.escritura ? formatearNumero(fila.escritura) : "-"}
                    </Td>
                    <Td alinear="right">{formatearNumero(fila.total_cancelar)}</Td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <Td colSpan={2} alinear="center">
                    Total
                  </Td>
                  <Td alinear="right">{formatearNumero(totalesEntrada.abono)}</Td>
                  {alicuotaTotalPorColumnaEntrada.map((total, indice) => (
                    <Td key={indice} alinear="right">
                      {formatearNumero(total)}
                    </Td>
                  ))}
                  <Td alinear="right">{formatearNumero(totalesEntrada.escritura)}</Td>
                  <Td alinear="right">{formatearNumero(totalesEntrada.total)}</Td>
                </tr>
              </tbody>
            </table>

            {refinanciamiento.financ_type !== "Contado" &&
              !esBiessLike(refinanciamiento.financ_type) && (
                <>
                  <div className="mb-4 text-[11px] font-bold">
                    Saldo a financiar: ${formatearNumero(saldoAFinanciar)}
                  </div>

                  <table className="amortizacion-tabla mb-4 w-full border-collapse text-[10.5px]">
                    <thead>
                      <tr>
                        <Th ancho="5%">Mes</Th>
                        <Th ancho="11%">Fecha de Pago</Th>
                        <Th ancho="10%">Capital</Th>
                        <Th ancho="10%">Interés</Th>
                        <Th ancho="10%">Abono Lote</Th>
                        {columnasAlicuotaCronograma.map((nombre, indice) => (
                          <Th key={indice}>{nombre}</Th>
                        ))}
                        <Th ancho="10%">Escritura</Th>
                        <Th ancho="12%">Cuota a Cancelar</Th>
                        <Th ancho="12%">Saldo Capital</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronograma.map((fila) => (
                        <tr key={fila.mes}>
                          <Td alinear="center">{fila.mes}</Td>
                          <Td alinear="center">{formatearFecha(fila.fecha)}</Td>
                          <Td alinear="center">{formatearNumero(fila.capital)}</Td>
                          <Td alinear="center">{formatearNumero(fila.interes)}</Td>
                          <Td alinear="center">{formatearNumero(fila.abono)}</Td>
                          {alicuotasDeFilaCronograma(fila).map(
                            (valor, indiceComponente) => (
                              <Td key={indiceComponente} alinear="center">
                                {valor ? formatearNumero(valor) : "-"}
                              </Td>
                            )
                          )}
                          <Td alinear="center">
                            {fila.escritura ? formatearNumero(fila.escritura) : "-"}
                          </Td>
                          <Td alinear="center" resaltar>
                            {formatearNumero(fila.cuota)}
                          </Td>
                          <Td alinear="center">{formatearNumero(fila.saldo)}</Td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <Td />
                        <Td />
                        <Td alinear="center">
                          {formatearNumero(totalesCronograma.capital)}
                        </Td>
                        <Td alinear="center">
                          {formatearNumero(totalesCronograma.interes)}
                        </Td>
                        <Td alinear="center">
                          {formatearNumero(totalesCronograma.abono)}
                        </Td>
                        {alicuotaTotalPorColumnaCronograma.map((total, indice) => (
                          <Td key={indice} alinear="center">
                            {formatearNumero(total)}
                          </Td>
                        ))}
                        <Td alinear="center">
                          {formatearNumero(totalesCronograma.escritura)}
                        </Td>
                        <Td />
                        <Td />
                      </tr>
                    </tbody>
                  </table>
                </>
              )}

            {comentarios.length > 0 && (
              <div className="mb-10 text-[11px]">
                <div className="mb-1 font-bold">OBSERVACIONES</div>
                <div className="flex flex-col gap-1 pl-6">
                  {comentarios.map((comentario, indice) => (
                    <div key={indice}>- {comentario}</div>
                  ))}
                </div>
              </div>
            )}

            {aprobado && (
              <div className="mt-16 flex flex-wrap justify-between gap-6">
                <Firma
                  nombre={apoderado ?? titular?.nombre ?? "—"}
                  rol={apoderado ? "APODERADO · C.C N°" : "C.C N°"}
                />
                <Firma
                  nombre={representanteEmpresa || "—"}
                  rol="INMOCONSTRUCCIONES CIA. LTDA."
                />
                {firmantesExtra
                  .filter((firmante) => firmante.nombre)
                  .map((firmante) => (
                    <Firma
                      key={firmante.id}
                      nombre={firmante.nombre}
                      rol={firmante.rol}
                    />
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <style jsx global>{`
        .anexo-imprimible {
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
          text-transform: uppercase;
        }
        .borrador-watermark {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .amortizacion-tabla thead {
          display: table-header-group;
        }
        .amortizacion-tabla tr {
          break-inside: avoid;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 1.8cm 1.5cm;
          }
          .anexo-imprimible {
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

// Una fila de la caja de datos superior — 1 o 2 pares label:valor, igual al anexo legacy.
function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <span className="font-bold">{label}: </span>
      {valor}
    </div>
  )
}

function Firma({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="w-64 text-center text-[11px]">
      <div className="mb-1 border-t border-black pt-1">{nombre}</div>
      {rol && <div className="font-bold">{rol}</div>}
    </div>
  )
}

function Th({ children, ancho }: { children: React.ReactNode; ancho?: string }) {
  return (
    <th
      className="border border-black bg-[#d9d9d9] px-1.5 py-1 text-center text-[10.5px] font-bold"
      style={ancho ? { width: ancho } : undefined}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  colSpan,
  alinear = "left",
  resaltar,
}: {
  children?: React.ReactNode
  colSpan?: number
  alinear?: "left" | "right" | "center"
  resaltar?: boolean
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-black px-1.5 py-1 ${
        alinear === "right"
          ? "text-right"
          : alinear === "center"
            ? "text-center"
            : "text-left"
      }`}
      style={resaltar ? { backgroundColor: "#BDE9C4" } : undefined}
    >
      {children}
    </td>
  )
}
