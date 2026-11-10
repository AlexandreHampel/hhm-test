import { randomInt } from 'node:crypto';

const issuedCpfs = new Set<string>();
const BASE_LENGTH = 9;

function checkDigit(digits: number[]): number {
  const weightStart = digits.length + 1;
  const sum = digits.reduce((total, digit, index) => total + digit * (weightStart - index), 0);
  const remainder = (sum * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}

/** Generates a structurally valid and unique Brazilian CPF, as digits only. */
export function generateCpf(): string {
  for (;;) {
    const base = Array.from({ length: BASE_LENGTH }, () => randomInt(0, 10));

    if (base.every((digit) => digit === base[0])) {
      continue;
    }

    const first = checkDigit(base);
    const second = checkDigit([...base, first]);
    const cpf = [...base, first, second].join('');

    if (!issuedCpfs.has(cpf)) {
      issuedCpfs.add(cpf);
      return cpf;
    }
  }
}
