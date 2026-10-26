"use client"

import { useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { Bell, CheckCircle2, Loader2, Send } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  notificacionesApi,
  type CrearNotificacionDto,
  type TipoNotificacion,
} from "@/lib/api/notificaciones-api"

const DEEPLINKS = [
  { value: "", label: "Ninguno" },
  { value: "/tabs/notification", label: "Bandeja de notificaciones" },
  { value: "/tabs/payments", label: "Pagos" },
  { value: "/tabs/home", label: "Inicio" },
  { value: "/tabs/properties", label: "Reservas" },
]

export default function NotificacionesPage() {
  const router = useRouter()

  const [titulo, setTitulo] = useState("")
  const [contenido, setContenido] = useState("")
  const [imagen, setImagen] = useState("")
  const [url, setUrl] = useState("")
  const [tipo, setTipo] = useState<TipoNotificacion>("individual")
  const [cedula, setCedula] = useState("")
  const [cuando, setCuando] = useState<"ahora" | "programar">("ahora")
  const [fecha, setFecha] = useState("")

  // segmento
  const [enMora, setEnMora] = useState(false)
  const [diasMora, setDiasMora] = useState("")
  const [cedulas, setCedulas] = useState("")
  const [lotes, setLotes] = useState("")
  const [prefijos, setPrefijos] = useState("")

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const segmentoJson = useMemo(() => {
    const s: Record<string, unknown> = {}
    if (enMora) s.en_mora = true
    if (diasMora.trim()) s.dias_mora_min = Number(diasMora)
    const list = (v: string) =>
      v.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
    if (cedulas.trim()) s.cedulas = list(cedulas)
    if (lotes.trim()) s.lotes = list(lotes)
    if (prefijos.trim()) s.prefijos_proyecto = list(prefijos)
    return s
  }, [enMora, diasMora, cedulas, lotes, prefijos])

  const puedeEnviar =
    titulo.trim() &&
    contenido.trim() &&
    (tipo !== "individual" || cedula.trim()) &&
    (tipo !== "segmentada" || Object.keys(segmentoJson).length > 0) &&
    (cuando === "ahora" || fecha) &&
    !enviando

  async function enviar() {
    setError(null)
    setEnviando(true)
    try {
      const dto: CrearNotificacionDto = {
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        tipo,
        imagen: imagen.trim() || undefined,
        url: url || undefined,
        user_id: tipo === "individual" ? cedula.trim() : undefined,
        segmento:
          tipo === "segmentada" ? JSON.stringify(segmentoJson) : undefined,
        fecha_enviar:
          cuando === "programar" && fecha
            ? new Date(fecha).toISOString()
            : undefined,
      }
      await notificacionesApi.crear(dto)
      setOk(true)
      setTimeout(() => router.push("/notificaciones/historial"), 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar")
    } finally {
      setEnviando(false)
    }
  }

  if (ok) {
    return (
      <div className="flex h-full flex-col">
        <DashboardTopbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <CheckCircle2 className="text-status-disponible h-12 w-12" />
          <p className="text-lg font-semibold">
            {cuando === "ahora" ? "Notificación enviada" : "Notificación programada"}
          </p>
          <p className="text-muted-foreground text-sm">Redirigiendo al historial…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center gap-2.5">
            <Bell className="text-primary h-5 w-5" />
            <h1 className="text-[22px] font-extrabold tracking-tight">
              Enviar notificación
            </h1>
          </div>

          <Card className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                maxLength={120}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Pago confirmado"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenido">Mensaje</Label>
              <Textarea
                id="contenido"
                value={contenido}
                maxLength={400}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Tu cuota de agosto fue registrada con éxito."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="imagen">Imagen (URL, opcional)</Label>
                <Input
                  id="imagen"
                  value={imagen}
                  onChange={(e) => setImagen(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Al tocar, abrir</Label>
                <Select
                  value={url || "none"}
                  onValueChange={(v) => setUrl(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEEPLINKS.map((d) => (
                      <SelectItem key={d.value || "none"} value={d.value || "none"}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as TipoNotificacion)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Un usuario (por cédula)</SelectItem>
                  <SelectItem value="global">Todos los usuarios</SelectItem>
                  <SelectItem value="segmentada">Segmento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "individual" && (
              <div className="space-y-1.5">
                <Label htmlFor="cedula">Cédula</Label>
                <Input
                  id="cedula"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="0102030405"
                />
              </div>
            )}

            {tipo === "segmentada" && (
              <div className="space-y-3 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={enMora}
                    onCheckedChange={(c) => setEnMora(Boolean(c))}
                  />
                  Usuarios con mora
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="diasMora">Días de mora mínimos</Label>
                  <Input
                    id="diasMora"
                    type="number"
                    value={diasMora}
                    onChange={(e) => setDiasMora(e.target.value)}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cedulas">Cédulas (separadas por coma)</Label>
                  <Textarea
                    id="cedulas"
                    className="min-h-[60px]"
                    value={cedulas}
                    onChange={(e) => setCedulas(e.target.value)}
                    placeholder="0102030405, 0203040506"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lotes">Lotes</Label>
                    <Input
                      id="lotes"
                      value={lotes}
                      onChange={(e) => setLotes(e.target.value)}
                      placeholder="F-M30-101, G-L2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prefijos">Prefijos de proyecto</Label>
                    <Input
                      id="prefijos"
                      value={prefijos}
                      onChange={(e) => setPrefijos(e.target.value)}
                      placeholder="F-, G-"
                    />
                  </div>
                </div>
                <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                  {JSON.stringify(segmentoJson, null, 2)}
                </pre>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>Cuándo</Label>
              <Select
                value={cuando}
                onValueChange={(v) => setCuando(v as "ahora" | "programar")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ahora">Enviar ahora</SelectItem>
                  <SelectItem value="programar">Programar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cuando === "programar" && (
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha y hora</Label>
                <Input
                  id="fecha"
                  type="datetime-local"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Se envía exactamente a esa hora (cola de BullMQ).
                </p>
              </div>
            )}
          </Card>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-2 pb-6">
            <Button
              variant="outline"
              onClick={() => router.push("/notificaciones/historial")}
            >
              Ver historial
            </Button>
            <Button onClick={enviar} disabled={!puedeEnviar}>
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {cuando === "ahora" ? "Enviar" : "Programar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
