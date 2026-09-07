/** Valida os dígitos verificadores do CPF (a AllowPay rejeita CPF matematicamente inválido). */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split('').map(Number)

  for (const [length, weight] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let sum = 0
    for (let i = 0; i < length; i += 1) {
      sum += digits[i]! * (weight - i)
    }
    const remainder = (sum * 10) % 11
    const check = remainder === 10 ? 0 : remainder
    if (check !== digits[length]) return false
  }

  return true
}
