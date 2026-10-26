export type PermisoConcedido = {
  recurso: string
  accion: string
}

export type AuthenticatedUser = {
  id: string
  email: string
  nombre: string
  roles: string[]
  permisos: PermisoConcedido[]
}
