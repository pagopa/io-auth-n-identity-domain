import { BlobService } from "azure-storage";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Client } from "../../generated/definitions/fn-lollipop/client";
import { RedisDependency } from "../redis/dependency";

export type FnLollipopClient = Client<"ApiKeyAuth">;
export type FnLollipopClientDependency = {
  readonly fnLollipopClient: FnLollipopClient;
  readonly blobService: BlobService;
  readonly containerName: NonEmptyString;
} & RedisDependency;
