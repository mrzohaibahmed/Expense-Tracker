const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a positive amount with up to two decimal places.");
  }
  const [rupees, paisa = ""] = trimmed.split(".");
  const minor = BigInt(rupees) * 100n + BigInt(paisa.padEnd(2, "0"));
  if (minor <= 0n || minor > MAX_MINOR) {
    throw new Error("Amount must be positive and within the supported range.");
  }
  return Number(minor);
}

export function parseOpeningBalance(value: string): number {
  const trimmed = value.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter an opening balance with up to two decimal places.");
  }
  const negative = trimmed.startsWith("-");
  const [rupees, paisa = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const minor = BigInt(rupees) * 100n + BigInt(paisa.padEnd(2, "0"));
  if (minor > MAX_MINOR) throw new Error("Opening balance exceeds the supported range.");
  return Number(negative ? -minor : minor);
}

export function formatMinor(value: number | bigint | string): string {
  const minor = BigInt(value);
  const sign = minor < 0n ? "−" : "";
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${sign}Rs ${whole.toLocaleString("en-PK")}.${fraction}`;
}

export function amountInputValue(value: number): string {
  const minor = BigInt(value);
  const absolute = minor < 0n ? -minor : minor;
  return `${minor < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function sumMinor(values: Iterable<number | bigint | string>): bigint {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  return total;
}
