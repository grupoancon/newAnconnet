// Datos de ubicación para el paso "Cliente" del wizard de oferta de compra: provincia
// (si el país es Ecuador) o estado (si es Estados Unidos), ciudad (cantones de
// Pichincha si la provincia es Pichincha) y sector (si la ciudad es Quito). El país en
// sí reutiliza la lista de nacionalidades (lib/const/nacionalidades.ts), que ya trae
// el nombre de cada país.

export const PROVINCIAS_ECUADOR = [
  "AZUAY",
  "BOLÍVAR",
  "CAÑAR",
  "CARCHI",
  "CHIMBORAZO",
  "COTOPAXI",
  "EL ORO",
  "ESMERALDAS",
  "GALÁPAGOS",
  "GUAYAS",
  "IMBABURA",
  "LOJA",
  "LOS RÍOS",
  "MANABÍ",
  "MORONA SANTIAGO",
  "NAPO",
  "ORELLANA",
  "PASTAZA",
  "PICHINCHA",
  "SANTA ELENA",
  "SANTO DOMINGO DE LOS TSÁCHILAS",
  "SUCUMBÍOS",
  "TUNGURAHUA",
  "ZAMORA CHINCHIPE",
]

export const ESTADOS_EEUU = [
  "ALABAMA",
  "ALASKA",
  "ARIZONA",
  "ARKANSAS",
  "CALIFORNIA",
  "CAROLINA DEL NORTE",
  "CAROLINA DEL SUR",
  "COLORADO",
  "CONNECTICUT",
  "DAKOTA DEL NORTE",
  "DAKOTA DEL SUR",
  "DELAWARE",
  "FLORIDA",
  "GEORGIA",
  "HAWÁI",
  "IDAHO",
  "ILLINOIS",
  "INDIANA",
  "IOWA",
  "KANSAS",
  "KENTUCKY",
  "LUISIANA",
  "MAINE",
  "MARYLAND",
  "MASSACHUSETTS",
  "MICHIGAN",
  "MINNESOTA",
  "MISISIPI",
  "MISURI",
  "MONTANA",
  "NEBRASKA",
  "NEVADA",
  "NUEVA JERSEY",
  "NUEVA YORK",
  "NUEVO HAMPSHIRE",
  "NUEVO MÉXICO",
  "OHIO",
  "OKLAHOMA",
  "OREGÓN",
  "PENSILVANIA",
  "RHODE ISLAND",
  "TENNESSEE",
  "TEXAS",
  "UTAH",
  "VERMONT",
  "VIRGINIA",
  "VIRGINIA OCCIDENTAL",
  "WASHINGTON",
  "WISCONSIN",
  "WYOMING",
]

// Cantones de Pichincha — la ciudad se vuelve una lista desplegable con estos valores
// solo cuando la provincia elegida es Pichincha; en cualquier otro caso se deja
// escribir libremente.
export const CANTONES_PICHINCHA = [
  "QUITO",
  "CAYAMBE",
  "MEJÍA",
  "PEDRO MONCAYO",
  "PEDRO VICENTE MALDONADO",
  "PUERTO QUITO",
  "RUMIÑAHUI",
  "SAN MIGUEL DE LOS BANCOS",
]

// Sector solo aplica cuando la ciudad elegida es Quito (dentro de Pichincha).
export const SECTORES_QUITO = [
  "QUITO NORTE",
  "QUITO SUR",
  "QUITO CENTRO",
  "VALLE DE LOS CHILLOS",
  "VALLE DE CUMBAYA",
]
