import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopAssertionRef: unique symbol;

// TODO: move these patterns to a shared location
export const HEX_CHAR_PATTERN = "[0-9a-fA-F]";
const BASE64_CHAR_PATTERN = "[A-Za-z0-9+/]";
const BASE64URL_CHAR_PATTERN = "[A-Za-z0-9_-]";

export const Sha256HexPattern = new RegExp(`^${HEX_CHAR_PATTERN}{64}$`);
const _Sha256Base64Pattern = new RegExp(`^${BASE64_CHAR_PATTERN}{43}=$`);
const Sha256Base64UrlPattern = new RegExp(`^${BASE64URL_CHAR_PATTERN}{43}$`);

const _Sha384HexPattern = new RegExp(`^${HEX_CHAR_PATTERN}{96}$`);
const _Sha384Base64Pattern = new RegExp(`^${BASE64_CHAR_PATTERN}{64}$`);
const Sha384Base64UrlPattern = new RegExp(`^${BASE64URL_CHAR_PATTERN}{64}$`);

const _Sha512HexPattern = new RegExp(`^${HEX_CHAR_PATTERN}{128}$`);
const _Sha512Base64Pattern = new RegExp(`^${BASE64_CHAR_PATTERN}{86}==$`);
const Sha512Base64UrlPattern = new RegExp(`^${BASE64URL_CHAR_PATTERN}{86}$`);

const sha256AssertionRefPattern = new RegExp(
  `^sha256-${Sha256Base64UrlPattern.source.slice(1, -1)}$`,
);

const sha384AssertionRefPattern = new RegExp(
  `^sha384-${Sha384Base64UrlPattern.source.slice(1, -1)}$`,
);

const sha512AssertionRefPattern = new RegExp(
  `^sha512-${Sha512Base64UrlPattern.source.slice(1, -1)}$`,
);

const Sha256AssertionRefSchema = z
  .string()
  .regex(sha256AssertionRefPattern, "Invalid sha256 assertion ref format");

const Sha384AssertionRefSchema = z
  .string()
  .regex(sha384AssertionRefPattern, "Invalid sha384 assertion ref format");

const Sha512AssertionRefSchema = z
  .string()
  .regex(sha512AssertionRefPattern, "Invalid sha512 assertion ref format");

/**
 * Lollipop assertion reference: a `{algo}-{base64url-thumbprint}` string
 * that uniquely identifies a reserved public key.
 */
export const LollipopAssertionRefSchema = z
  .union(
    [
      Sha256AssertionRefSchema,
      Sha384AssertionRefSchema,
      Sha512AssertionRefSchema,
    ],
    "Invalid assertion ref format",
  )
  .brand<typeof BrandLollipopAssertionRef>();

export type LollipopAssertionRef = z.infer<typeof LollipopAssertionRefSchema>;
