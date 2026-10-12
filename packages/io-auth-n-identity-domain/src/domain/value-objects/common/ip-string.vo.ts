import { z } from "zod";

/**
 * An IP address string, either IPv4 or IPv6.
 */
export const IPStringSchema = z.union([z.ipv4(), z.ipv6()]);

export type IPString = z.infer<typeof IPStringSchema>;
