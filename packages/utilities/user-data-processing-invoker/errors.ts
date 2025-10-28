export type InvalidFiscalCodeError = Error & {
  readonly name: "InvalidFiscalCodeError";
  readonly fiscalCode: string;
};

export const toInvalidFiscalCodeError = (
  fiscalCode: string,
): InvalidFiscalCodeError => ({
  name: "InvalidFiscalCodeError",
  fiscalCode,
  message: `Invalid fiscal code: ${fiscalCode}`,
});
