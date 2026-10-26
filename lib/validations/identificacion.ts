// Valida el campo "Identificación" del formulario de nuevo proceso. El tipo de
// documento se infiere de la forma del valor (10 digitos -> cedula ecuatoriana, 13
// digitos -> RUC, cualquier otra cosa -> pasaporte) y se aplica la regla que
// corresponda a cada uno.

// Algoritmo modulo 10 del Registro Civil ecuatoriano: valida provincia (01-24), tipo de
// persona (tercer digito <= 5, natural) y el digito verificador.
function validarCedulaEcuatoriana(cedula: string): boolean {
  const provincia = parseInt(cedula.slice(0, 2), 10)
  if (provincia < 1 || provincia > 24) return false

  const tercerDigito = parseInt(cedula[2], 10)
  if (tercerDigito > 5) return false

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula[i], 10) * coeficientes[i]
    if (valor >= 10) valor -= 9
    suma += valor
  }
  const digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10)
  return digitoVerificador === parseInt(cedula[9], 10)
}

// Devuelve el mensaje de error a mostrar, o null si el valor es valido (o todavia esta
// incompleto y no corresponde juzgarlo aun — ej. van 5 digitos de una cedula que
// terminaria en 10).
export function validarIdentificacion(valor: string): string | null {
  const limpio = valor.trim()
  if (!limpio) return null

  const soloDigitos = /^\d+$/.test(limpio)

  if (soloDigitos) {
    if (limpio.length === 10) {
      return validarCedulaEcuatoriana(limpio) ? null : "Cédula ecuatoriana inválida."
    }
    if (limpio.length === 13) {
      // RUC: solo se exige que tenga 13 digitos, y ya los tiene.
      return null
    }
    // Numero incompleto (todavia no llega a 10 ni a 13 digitos) — no marcar error
    // mientras el usuario sigue escribiendo.
    return null
  }

  // Trae letras: se trata como pasaporte, debe ser alfanumerico (sin espacios ni
  // simbolos).
  return /^[A-Za-z0-9]+$/.test(limpio)
    ? null
    : "El pasaporte debe ser alfanumérico (sin espacios ni símbolos)."
}
