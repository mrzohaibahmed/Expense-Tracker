export const MAX_SAFE_MONEY_MINOR = Number.MAX_SAFE_INTEGER;
export const MIN_SAFE_MONEY_MINOR = Number.MIN_SAFE_INTEGER;

declare const minorUnitsBrand: unique symbol;
export type MinorUnits = number & { readonly [minorUnitsBrand]: true };

export function minorUnitsFromDatabase(value: number): MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Money from the database must be a safe integer.");
  }

  return value as MinorUnits;
}

export function positiveMinorUnits(value: number): MinorUnits {
  const minorUnits = minorUnitsFromDatabase(value);
  if (minorUnits <= 0) {
    throw new RangeError("The amount must be greater than zero.");
  }

  return minorUnits;
}

export function minorUnitsToDatabase(value: MinorUnits): number {
  return value;
}
