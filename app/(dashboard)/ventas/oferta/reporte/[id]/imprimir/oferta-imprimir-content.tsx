"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { Plus, Printer, Trash2, ArrowLeft } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { LUGARES_VENTA_OPCIONES } from "@/components/shared/select-options"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  actualizarOferta,
  crearTipoInmueble,
  listarClientesExtra,
  listarTiposInmueble,
  obtenerDatosFinancieros,
  obtenerFinanciamiento,
  obtenerOferta,
  obtenerProceso,
  type ClienteExtraBackend,
  type DatosFinancierosBackend,
  type FinanciamientoBackend,
  type OfertaBackend,
  type ProcesoBackend,
  type TipoInmuebleBackend,
} from "@/lib/api/ventas-api"
import {
  listarRepresentantesActivos,
  type RepresentanteConvenio,
} from "@/lib/api/convenios-api"
import { separarTelefono } from "@/lib/const/codigos-telefonicos"

function formatearPrecio(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

function formatearMetraje(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m2`
}

function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "—"
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return "—"
  return fecha.toLocaleString("es-EC", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function calcularEdad(fechaNacimiento?: string | Date | null): string {
  if (!fechaNacimiento) return ""
  const nacimiento = new Date(fechaNacimiento)
  if (isNaN(nacimiento.getTime())) return ""
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return `${edad} años`
}

function tel(valor: string | null | undefined): string {
  if (!valor) return ""
  const { prefijo, numero } = separarTelefono(valor)
  return numero ? `${prefijo}${numero}` : ""
}

type Firmante = { id: string; nombre: string; rol: string }

export function OfertaImprimirContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [oferta, setOferta] = useState<OfertaBackend | null>(null)
  const [financieros, setFinancieros] = useState<DatosFinancierosBackend | null>(null)
  const [financiamiento, setFinanciamiento] = useState<FinanciamientoBackend | null>(null)
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tipo de inmueble — no lo pide ningún paso del wizard todavía, se edita acá mismo y
  // se guarda sobre la oferta (misma actualizarOferta de siempre). Sale de un catálogo
  // persistido (catalogo_tipo_inmueble): arranca en "TERRENO" y el usuario puede
  // agregar valores nuevos que quedan guardados para todos los reportes. El descuento y
  // el ofrecimiento YA NO se editan acá — ahora vienen del financiamiento del proceso
  // (ver financiamiento?.discount/extra_discount/ofrecimientos más abajo), para que el
  // reporte de oferta siempre muestre lo mismo que ya se acordó en el financiamiento.
  const [tipoInmueble, setTipoInmueble] = useState("")
  const [guardandoInmueble, setGuardandoInmueble] = useState(false)
  const [tiposInmuebleCatalogo, setTiposInmuebleCatalogo] = useState<
    TipoInmuebleBackend[]
  >([])
  const [nuevoTipoInmueble, setNuevoTipoInmueble] = useState("")
  const [agregandoTipo, setAgregandoTipo] = useState(false)

  // Fondo de hoja membretada para la impresión (public/images/membrete-oferta.png).
  // Se puede desactivar si se va a imprimir sobre papel ya membretado.
  const [conMembrete, setConMembrete] = useState(true)

  // Firmas — el cliente y el asesor son fijos (vienen del proceso/oferta); el
  // representante de la empresa se elige de una lista (la misma que el
  // convenio: Configuración > Convenios > Representantes, ver
  // listarRepresentantesActivos) en vez de escribirse a mano;
  // se pueden agregar más firmantes desde los candidatos ya registrados (cónyuge,
  // apoderado, referido, clientes extra) o con nombre libre. Todo esto es solo para
  // esta impresión, no se guarda.
  const [representantesDisponibles, setRepresentantesDisponibles] = useState<
    RepresentanteConvenio[]
  >([])
  const [representanteEmpresa, setRepresentanteEmpresa] = useState("")
  const [firmantesExtra, setFirmantesExtra] = useState<Firmante[]>([])

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Proceso inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const procesoData = await obtenerProceso(idNumero)
        if (cancelado) return
        if (!procesoData) {
          setError("No se encontró el proceso.")
          return
        }
        setProceso(procesoData)

        const [
          lote,
          ofertaData,
          financierosData,
          financiamientoData,
          extra,
          representantes,
          tiposInmueble,
        ] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerOferta(idNumero),
          obtenerDatosFinancieros(idNumero),
          obtenerFinanciamiento(idNumero),
          listarClientesExtra(idNumero),
          listarRepresentantesActivos(),
          listarTiposInmueble(),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setOferta(ofertaData)
        setFinancieros(financierosData)
        setFinanciamiento(financiamientoData)
        setClientesExtra(extra)
        setRepresentantesDisponibles(representantes)
        // Igual que el convenio: arranca con el primer representante activo.
        setRepresentanteEmpresa((actual) => actual || representantes[0]?.nombre || "")
        setTiposInmuebleCatalogo(tiposInmueble)
        // Default "TERRENO" cuando la oferta todavía no tiene un tipo elegido.
        setTipoInmueble(ofertaData?.cli_tipoInmueble || "TERRENO")

        if (!ofertaData) {
          setError("Este proceso todavía no tiene una oferta ingresada.")
        }
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
  // El apoderado es opcional: la sección solo sale si se capturó algún dato suyo.
  const tieneApoderado = Boolean(
    oferta?.cli_representante?.trim() ||
    oferta?.cli_representanteID?.trim() ||
    oferta?.cli_telefR?.trim() ||
    oferta?.cli_representanteMail?.trim()
  )
  // Solo las promociones que se eligieron en el financiamiento; si no hay, no se muestra.
  const nombresPromociones = (financiamiento?.promociones ?? [])
    .map((promocion) => promocion.nombre)
    .filter((nombre): nombre is string => Boolean(nombre))

  // Candidatos disponibles para agregar como firmantes extra — solo los que tienen
  // nombre cargado. "tipo" evita agregarlos dos veces.
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
    if (oferta.cli_representante) {
      lista.push({
        tipo: "apoderado",
        nombre: oferta.cli_representante,
        rolSugerido: "Apoderado",
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
  }, [oferta, clientesExtra, firmantesExtra])

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

  async function agregarTipoInmueble() {
    const nombre = nuevoTipoInmueble.trim().toUpperCase()
    if (!nombre) return
    setAgregandoTipo(true)
    try {
      const creado = await crearTipoInmueble(nombre)
      setTiposInmuebleCatalogo((anterior) =>
        anterior.some((t) => t.id === creado.id) ? anterior : [...anterior, creado]
      )
      setTipoInmueble(creado.nombre)
      setNuevoTipoInmueble("")
      toast({
        variant: "success",
        description: `"${creado.nombre}" agregado al catálogo.`,
      })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo agregar el tipo",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setAgregandoTipo(false)
    }
  }

  async function guardarTipoInmueble() {
    setGuardandoInmueble(true)
    try {
      await actualizarOferta(idNumero, {
        cli_tipoInmueble: tipoInmueble || undefined,
      })
      toast({ variant: "success", description: "Tipo de inmueble actualizado." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardandoInmueble(false)
    }
  }

  const precio = loteInfo?.pvp ?? proceso?.lote_price ?? null
  const precioNumero = precio != null ? parseFloat(String(precio)) : 0
  // Mismo criterio que financiamiento-reporte-content.tsx: "Contado"/"Crédito BIESS"
  // llevan un descuento fijo (5%/3%) aunque el financiamiento se haya guardado sin
  // `discount`; el descuento extra se suma aparte. Sin financiamiento todavía, no hay
  // nada que mostrar (ver descuentoMonto = null más abajo, no 0 — 0 se leería como "sin
  // descuento" en vez de "todavía no se sabe").
  const descuentoTipo =
    Number(financiamiento?.discount) ||
    (financiamiento?.financ_type === "Contado"
      ? precioNumero * 0.05
      : financiamiento?.financ_type === "Crédito BIESS"
        ? precioNumero * 0.03
        : 0)
  const descuentoMonto = financiamiento
    ? descuentoTipo + (Number(financiamiento.extra_discount) || 0)
    : null
  const total = precioNumero - (descuentoMonto ?? 0)

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <div className="no-print border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          Volver
        </Button>
        {oferta && (
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
      ) : error || !oferta ? (
        <div className="p-8">
          <EmptyState
            title="No se puede abrir el reporte"
            description={error ?? "No se encontró la oferta."}
            dashed
          />
        </div>
      ) : (
        <>
          <div className="no-print border-border bg-card mx-auto mt-4 w-full max-w-[820px] rounded-md border p-4">
            <div className="mb-3 text-sm font-semibold">Configurar antes de imprimir</div>
            <div className="mb-4">
              <SelectField
                label="Tipo de inmueble"
                placeholder="Seleccione el tipo de inmueble"
                options={Array.from(
                  new Set([
                    ...tiposInmuebleCatalogo.map((t) => t.nombre),
                    ...(tipoInmueble ? [tipoInmueble] : []),
                  ])
                )}
                value={tipoInmueble}
                onValueChange={setTipoInmueble}
              />
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Agregar otro tipo…"
                  value={nuevoTipoInmueble}
                  onChange={(e) => setNuevoTipoInmueble(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      agregarTipoInmueble()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={agregandoTipo || !nuevoTipoInmueble.trim()}
                  onClick={agregarTipoInmueble}
                >
                  Agregar
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={guardandoInmueble}
              onClick={guardarTipoInmueble}
            >
              Guardar tipo de inmueble
            </Button>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conMembrete}
                onChange={(e) => setConMembrete(e.target.checked)}
              />
              Imprimir con hoja membretada de fondo
            </label>

            <div className="border-border mt-4 border-t pt-4">
              <div className="mb-2 text-sm font-semibold">
                Representante de la empresa (firma)
              </div>
              <SelectField
                placeholder="Seleccione quién firma por la empresa"
                options={representantesDisponibles.map((persona) => persona.nombre)}
                value={representanteEmpresa}
                onValueChange={setRepresentanteEmpresa}
              />
            </div>

            <div className="border-border mt-4 border-t pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Firmantes adicionales</div>
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

          <div className="reporte-imprimible mx-auto my-6 w-full max-w-[820px] bg-white p-10 text-black">
            <Hoja conMembrete={conMembrete}>
              <div className="mb-4 text-center">
                <div className="text-2xl">
                  OFERTA DE COMPRA <span className="font-bold">{oferta.id}</span>
                </div>
                <div className="text-sm font-bold">
                  Fecha: {formatearFecha(oferta.created_at)}
                </div>
              </div>

              <SeccionTitulo texto="DATOS INMUEBLE" />
              <table className="mb-3 w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <Th>PROYECTO</Th>
                    <Th>NUMERO INMUEBLE</Th>
                    <Th>AREA M2</Th>
                    <Th>VALOR INMUEBLE</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td rowSpan={3}>{loteInfo?.proyecto?.nombre ?? "—"}</Td>
                    <Td rowSpan={3}>{loteInfo?.codigo ?? proceso?.cli_lote ?? "—"}</Td>
                    <Td>{formatearMetraje(loteInfo?.areaUtil ?? proceso?.lote_mts)}</Td>
                    <Td>{formatearPrecio(precio)}</Td>
                  </tr>
                  <tr>
                    <Td className="font-bold">Descuento</Td>
                    <Td>
                      {descuentoMonto != null
                        ? `-${formatearPrecio(descuentoMonto)}`
                        : "—"}
                    </Td>
                  </tr>
                  <tr>
                    <Td className="font-bold">Total</Td>
                    <Td className="font-bold">{formatearPrecio(total)}</Td>
                  </tr>
                </tbody>
              </table>

              <FilaLibre>
                <Campo
                  label="TIPO DE INMUEBLE"
                  valor={tipoInmueble || oferta.cli_tipoInmueble}
                />
                <Campo label="OFRECIMIENTO" valor={financiamiento?.ofrecimientos} />
                <Campo
                  label="LUGAR DE VENTA"
                  valor={
                    LUGARES_VENTA_OPCIONES.find((op) => op.value === proceso?.location)
                      ?.label ?? proceso?.location
                  }
                />
              </FilaLibre>

              <SeccionTitulo texto="DATOS PERSONALES - CLIENTE" />
              <Fila3>
                <Campo label="Apellidos y Nombres" valor={titular?.nombre} ancho={2} />
                <Campo label="Sexo" valor={titular?.sexo} />
              </Fila3>
              <Fila3>
                <Campo label="C.I o Pasaporte" valor={titular?.identificacion} />
                <Campo
                  label="Fecha de Nac."
                  valor={titular?.fecha_nacimiento?.slice(0, 10)}
                />
                <Campo label="Edad" valor={calcularEdad(titular?.fecha_nacimiento)} />
              </Fila3>
              <Fila3>
                <Campo label="Estado civil" valor={titular?.estado_civil} />
                <Campo label="Pais" valor={oferta.cli_pais} />
                <Campo label="Provincia/Estado" valor={oferta.cli_provin} />
              </Fila3>
              <Fila3>
                <Campo label="Ciudad" valor={oferta.cli_ciudad} />
                <Campo label="Sector" valor={oferta.cli_sector} />
              </Fila3>
              <Fila3>
                <Campo
                  label="Dirección del Hogar"
                  valor={oferta.cli_direccion}
                  ancho={3}
                />
              </Fila3>
              <Fila3>
                <Campo label="Teléfono Celular" valor={tel(oferta.cli_telef)} />
                <Campo label="Correo Electrónico" valor={oferta.cli_mail} ancho={2} />
              </Fila3>
              <Fila3>
                <Campo
                  label="Ingresos Mensuales"
                  valor={
                    financieros?.ingresoMensual != null
                      ? String(financieros.ingresoMensual)
                      : null
                  }
                />
                <Campo
                  label="Gastos Mensuales"
                  valor={
                    financieros?.gastosMensual != null
                      ? String(financieros.gastosMensual)
                      : null
                  }
                />
              </Fila3>
              <Fila3>
                <Campo
                  label="Capacidad de Ahorro Mensual"
                  valor={
                    financieros?.ahorroMensual != null
                      ? String(financieros.ahorroMensual)
                      : null
                  }
                />
                <Campo
                  label="Ahorro Actual"
                  valor={
                    financieros?.ahorroActual != null
                      ? String(financieros.ahorroActual)
                      : null
                  }
                />
              </Fila3>

              <SeccionTitulo texto="DATOS LABORALES - CLIENTE" />
              <DatosLaboralesCliente oferta={oferta} />

              <SeccionTitulo texto="REFERENCIAS FAMILIARES - CLIENTE" />
              <div className="mb-1.5 grid grid-cols-2 gap-x-4 text-xs">
                <div className="flex flex-col gap-y-1">
                  <Campo label="1) Referencia Familiar" valor={oferta.cli_reFami1} />
                  <Campo label="Parentezco" valor={oferta.cli_paren1} />
                  <Campo label="Telf. Celular" valor={tel(oferta.cli_telParen1)} />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Campo label="2) Referencia Familiar" valor={oferta.cli_reFami2} />
                  <Campo label="Parentezco" valor={oferta.cli_paren2} />
                  <Campo label="Telf. Celular" valor={tel(oferta.cli_telParen2)} />
                </div>
              </div>

              {tieneApoderado && (
                <>
                  <SeccionTitulo texto="DATOS APODERADO" />
                  <Fila3>
                    <Campo
                      label="Apellidos y Nombres"
                      valor={oferta.cli_representante}
                      ancho={2}
                    />
                    <Campo label="C.I o Pasaporte" valor={oferta.cli_representanteID} />
                  </Fila3>
                  <Fila3>
                    <Campo label="Telf. Celular" valor={tel(oferta.cli_telefR)} />
                    <Campo
                      label="Correo Electrónico"
                      valor={oferta.cli_representanteMail}
                      ancho={2}
                    />
                  </Fila3>
                </>
              )}
            </Hoja>

            <Hoja conMembrete={conMembrete} ultima>
              {oferta.cli_conyuName && (
                <div>
                  <SeccionTitulo texto="DATOS PERSONALES - CÓNYUGE" />
                  <FilaLibre>
                    <Campo
                      label="Apellidos y Nombres"
                      valor={oferta.cli_conyuName}
                      ancho={2}
                    />
                  </FilaLibre>
                  <Fila3>
                    <Campo label="C.I o Pasaporte" valor={oferta.cli_conyuID} />
                    <Campo label="Telf. Celular" valor={tel(oferta.cli_conyuCell)} />
                  </Fila3>
                  <Fila3>
                    <Campo
                      label="Empresa en la que Trabaja"
                      valor={oferta.cli_conyuTrabEmpresa}
                    />
                    <Campo
                      label="Dirección de la Empresa"
                      valor={oferta.cli_conyuTrabDireccion}
                    />
                    <Campo
                      label="Telf. Trabajo"
                      valor={tel(oferta.cli_conyuTrabTelefono)}
                    />
                  </Fila3>
                </div>
              )}

              <SeccionTitulo texto="DATOS REFERIDOS" />
              <Fila3>
                <Campo label="Apellidos y Nombres" valor={oferta.referido_nombre} />
                <Campo label="Telf. Celular" valor={tel(oferta.referido_telefono)} />
                <Campo label="Relación" valor={oferta.referido_relacion} />
              </Fila3>

              <SeccionTitulo texto="DATOS ASESOR INMOBILIARIO" />
              <Fila3>
                <Campo
                  label="Asesor Final (Cierre de Venta)"
                  valor={proceso?.cli_asesor}
                />
                <Campo label="Telf. Celular" valor={tel(oferta.cli_asesorTelf)} />
              </Fila3>
              <Fila3>
                <Campo label="Como nos contacto" valor={oferta.cli_contac} />
                <Campo label="Nombre de contacto" valor={oferta.cli_contacNombre} />
              </Fila3>
              <Fila3>
                <Campo label="Pospectador" valor={oferta.prospectador} />
                <Campo
                  label="Asistencia en proyecto"
                  valor={oferta.cli_asistenciaProyecto}
                />
                <Campo label="Visitó el proyecto" valor={oferta.cli_visitaProyecto} />
              </Fila3>
              {nombresPromociones.length > 0 && (
                <Fila3>
                  <Campo
                    label="Promoción"
                    valor={nombresPromociones.join(", ")}
                    ancho={3}
                  />
                </Fila3>
              )}
              <FilaLibre>
                <Campo
                  label="¿Qué le motivo la compra?"
                  valor={oferta.cli_motivoCompra}
                  ancho={3}
                />
              </FilaLibre>

              <div className="mb-3 text-xs">
                <span className="font-bold">Observaciones Generales: </span>
                {oferta.cli_observation || "—"}
              </div>

              <div className="mb-3 border border-black p-2 text-[10px] leading-snug">
                <span className="font-bold">
                  CLÁUSULA DE PROTECCIÓN DE DATOS Y AUTORIZACIÓN:{" "}
                </span>
                En cumplimiento con la Ley Orgánica de Protección de Datos Personales
                (LOPDP), <span className="font-bold">INMOCONSTRUCCIONES CIA. LTDA.</span>,
                en calidad de Responsable del Tratamiento, informa que los datos
                personales recopilados en este formulario serán tratados para: (i)
                Gestionar el proceso de reserva y oferta de compraventa del inmueble; (ii)
                Realizar el análisis de perfil de riesgo crediticio y comportamiento
                comercial a través de fuentes autorizadas (Central de Riesgos/Burós de
                Crédito); (iii) Cumplir con obligaciones de prevención de lavado de
                activos; y (iv) Gestionar la relación precontractual.
                <br />
                <br />
                <span className="font-bold">Autorización: </span>
                El Titular autoriza de manera libre y específica a INMOCONSTRUCCIONES CIA.
                LTDA. para tratar sus datos y consultar su historial crediticio en
                entidades públicas o privadas. Los datos se conservarán por el tiempo
                necesario para cumplir la finalidad o los plazos legales. Usted puede
                ejercer sus derechos de Acceso, Rectificación, Supresión, Oposición y
                otros, mediante correo a:{" "}
                <span className="font-bold">privacidadydatos@grupoancon.com</span>.
                Nuestra Política de Privacidad completa está disponible en nuestra página
                web www.grupoancon.com
              </div>

              <div className="mb-3 text-center text-sm italic">
                ¡¡ FELICITACIONES, HA REALIZADO UNA GRAN INVERSIÓN !!
              </div>

              <div className="mb-3 border border-black p-2 text-[10px] leading-snug">
                <span className="font-bold">NOTA: </span>
                Con el valor que usted entrega a la firma de este instrumento, ha
                reservado su inmueble. En caso de que usted desista de la compra, perderá
                este primer abono, a menos que a la firma de este documento usted no
                conozca el bien, lo que podrá realizarlo en los próximos tres dias;
                nuestros asesores estaran gustosos de atenderle.
              </div>

              <div className="mb-8 text-[10px]">
                * SOLO EL CONVENIO DE RESERVA DEBIDAMENTE FIRMADO GARANTIZA LA ASIGNACIÓN
                DEL INMUEBLE A SU NOMBRE
              </div>

              <div className="mt-16 flex flex-wrap justify-between gap-6">
                <Firma nombre={titular?.nombre ?? "—"} rol="C.C N°" />
                <Firma nombre={proceso?.cli_asesor ?? "—"} rol="" />
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
            </Hoja>
          </div>
        </>
      )}

      <style jsx global>{`
        .reporte-imprimible {
          font-family: Arial, Helvetica, sans-serif;
          /* Los navegadores no imprimen fondos de color por defecto (solo texto/bordes)
             salvo que se lo pidas explícitamente — sin esto, los encabezados verdes de
             sección salen blancos al imprimir aunque se vean bien en pantalla. */
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        /* Cada <div class="hoja"> es una página física. En pantalla solo se apilan; al
           imprimir cada una ocupa exactamente una hoja (min-height:100vh + salto
           después) y lleva su propio fondo membretado (.hoja-membrete, position
           absolute dentro de la hoja). Se evita position:fixed a propósito: rompe la
           paginación de Chrome al imprimir. El archivo va en
           public/images/membrete-oferta.png; si no existe, el fondo no aparece. */
        .hoja {
          position: relative;
        }
        .hoja-membrete {
          display: none;
        }
        .hoja-contenido {
          position: relative;
          z-index: 1;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 0;
          }
          .reporte-imprimible {
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
            background: transparent !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .hoja {
            min-height: 100vh;
            box-sizing: border-box;
            /* Área segura: separa el texto del logo (arriba) y del pie con la
               dirección + hojas (abajo) del membrete. */
            padding: 3cm 1.6cm 3.6cm;
            page-break-after: always;
            break-after: page;
          }
          .hoja-ultima {
            page-break-after: auto;
            break-after: auto;
          }
          .hoja-membrete {
            display: block;
            position: absolute;
            inset: 0;
            background-image: url("/images/membrete-oferta.png");
            background-position: top center;
            background-repeat: no-repeat;
            background-size: 100% 100%;
            z-index: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}

// Una página física del reporte. `conMembrete` pinta el fondo membretado; `ultima`
// evita el salto de página después de la última hoja.
function Hoja({
  conMembrete,
  ultima,
  children,
}: {
  conMembrete: boolean
  ultima?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`hoja${ultima ? "hoja-ultima" : ""}`}>
      {conMembrete && <div className="hoja-membrete" aria-hidden />}
      <div className="hoja-contenido">{children}</div>
    </div>
  )
}

// Los datos laborales dependen de la actividad elegida en el wizard (mismos grupos que el
// paso Trabajo): dependiente/empleado, independiente/comerciante y remesas piden campos
// distintos; jubilado y otro solo muestran la actividad.
function DatosLaboralesCliente({ oferta }: { oferta: OfertaBackend }) {
  const actividad = oferta.cli_trabActividad
  const esDependiente = actividad === "DEPENDIENTE" || actividad === "EMPLEADO"
  const esIndependiente = actividad === "INDEPENDIENTE" || actividad === "COMERCIANTE"
  const esRemesas = actividad === "REMESAS DEL EXTERIOR"

  return (
    <>
      <Fila3>
        <Campo label="Actividad" valor={actividad} ancho={3} />
      </Fila3>
      {esDependiente && (
        <>
          <Fila3>
            <Campo label="Empresa donde Trabaja" valor={oferta.cli_trabEmpresa} />
            <Campo label="Cargo Trabajo" valor={oferta.cli_trabCargo} />
            <Campo label="Ciudad" valor={oferta.cli_trabTiempo} />
          </Fila3>
          <Fila3>
            <Campo label="Sector" valor={oferta.cli_trabSector} />
            <Campo label="Dirección Trabajo" valor={oferta.cli_trabDireccion} ancho={2} />
          </Fila3>
          <Fila3>
            <Campo label="Telf. Trabajo" valor={tel(oferta.cli_trabTelefono)} />
          </Fila3>
        </>
      )}
      {esIndependiente && (
        <Fila3>
          <Campo label="Nombre del Negocio" valor={oferta.cli_trabTipoNegocio} />
          <Campo label="RUC / RISE" valor={oferta.cli_trabRuc} />
          <Campo label="Ingresos Mensuales Aprox." valor={oferta.cli_trabIngresos} />
        </Fila3>
      )}
      {esRemesas && (
        <Fila3>
          <Campo
            label="Nombre de quien Envía Dinero"
            valor={oferta.cli_trabRuc}
            ancho={2}
          />
          <Campo label="Relación" valor={oferta.cli_trabIngresos} />
        </Fila3>
      )}
    </>
  )
}

function SeccionTitulo({ texto }: { texto: string }) {
  return (
    <div
      className="mt-3 mb-2 rounded-sm py-1.5 text-center text-xs font-bold"
      style={{ backgroundColor: "#BDE9C4" }}
    >
      {texto}
    </div>
  )
}

function Fila3({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">{children}</div>
}

function FilaLibre({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">{children}</div>
}

function Campo({
  label,
  valor,
  ancho = 1,
}: {
  label: string
  valor: string | number | null | undefined
  ancho?: number
}) {
  return (
    <div style={{ gridColumn: `span ${ancho} / span ${ancho}` }}>
      <span className="font-bold">{label}: </span>
      {valor || valor === 0 ? valor : "—"}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-black bg-white p-1.5 text-xs">{children}</th>
}

function Td({
  children,
  rowSpan,
  className,
}: {
  children: React.ReactNode
  rowSpan?: number
  className?: string
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={`border border-black p-1.5 text-center text-xs ${className ?? ""}`}
    >
      {children}
    </td>
  )
}

function Firma({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="w-40 text-center text-[10px]">
      <div className="mb-1 border-t border-black pt-1">{nombre}</div>
      {rol && <div className="font-bold">{rol}</div>}
    </div>
  )
}
