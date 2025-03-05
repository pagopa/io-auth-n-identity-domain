import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { Profile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { OnProfileUpdateDocument } from "../../types/on-profile-update-input-document";
import { ProfileRepository } from "../../repositories";

export const generateId = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => generateVersionedModelId<Profile, "fiscalCode">(fiscalCode, version);

export const mockProfiles = [
  {
    email: "Eleanore.Kuphal@example.net" as EmailString,
    fiscalCode: "VSFNVG14A39Y596X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c2" as NonEmptyString
  },
  {
    email: "Humberto38@example.net" as EmailString,
    fiscalCode: "DRUQIL23A18Y188X" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "ba130521-8bab-4a68-a5e9-07a7e59f1f24" as NonEmptyString
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it" as EmailString,
    fiscalCode: "ISPXNB32R82Y766D" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "57807630-19c0-4cbd-a53f-a9ba3c3e0660" as NonEmptyString
  },
  {
    email: "Reed_Klocko@example.com" as EmailString,
    fiscalCode: "PVQEBX22A89Y092X" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "ad893263-21a5-43af-856b-88bc80fdb5a2" as NonEmptyString
  },
  {
    email: "derd@example.com" as EmailString,
    fiscalCode: "PVQEBX22A89Y092X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    version: 1 as NonNegativeInteger,
    _self: "19e3eeb9-0fc0-472b-8df9-b29eab5a2d50" as NonEmptyString
  },
  {
    email: "derd@example.com" as EmailString,
    fiscalCode: "PVQEBX22A89Y092X" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 2,
    version: 2 as NonNegativeInteger,
    _self: "4b4c94d4-a350-4f27-9c76-ba669eca48a9" as NonEmptyString
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it" as EmailString,
    fiscalCode: "ISPXNB32R82Y766D" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    id: "ISPXNB32R82Y766D-0000000000000001",
    version: 1 as NonNegativeInteger,
    _self: "eb28139a-f875-4276-81c5-b3f7b01f712a" as NonEmptyString
  },
  {
    fiscalCode: "not-valid" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    acceptedTosVersion: 1,
    version: 0 as NonNegativeInteger
  },
  {
    email: "Eleanore.Kuphal@example.net" as EmailString,
    fiscalCode: "VSFNVG14A39Y596X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 1 as NonNegativeInteger,
    acceptedTosVersion: 0,
    _self: "aa406556-b003-4387-89ef-8f127ec9b2da" as NonEmptyString
  },
  {
    email: "Eleanore.Kuphal@example.net" as EmailString,
    fiscalCode: "VSFNVG14A39Y596X" as FiscalCode,
    isEmailValidated: true,
    isInboxEnabled: false,
    version: 2 as NonNegativeInteger,
    _self: "f43db63b-5549-403d-98a5-e781934c796f" as NonEmptyString
  },
  {
    fiscalCode: "AAANVG14A39Y596X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c5" as NonEmptyString
  },
  {
    email: "newEmail@example.net" as EmailString,
    fiscalCode: "AAANVG14A39Y596X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 1 as NonNegativeInteger,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732c6" as NonEmptyString
  },
  {
    email: "newEmail@example.net" as EmailString,
    fiscalCode: "BBBNVG14A39Y596X" as FiscalCode,
    isEmailValidated: false,
    isInboxEnabled: false,
    version: 0 as NonNegativeInteger,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732d7" as NonEmptyString
  },
  {
    fiscalCode: "BBBNVG14A39Y596X" as FiscalCode,
    isInboxEnabled: false,
    version: 1 as NonNegativeInteger,
    _self: "96dfb60b-c09b-4044-8cb6-1405ca6732e8" as NonEmptyString
  }
].map(item => ({
  ...item,
  id: generateId(
    item.fiscalCode as FiscalCode,
    item.version as NonNegativeInteger
  )
}));

export const onProfileUpdateFindDocumentMock = vi.fn((fc, version) => _args =>
  pipe(
    mockProfiles.find(
      profile =>
        profile.id === generateId(fc, version) && profile.fiscalCode === fc
    ),
    foundProfile =>
      TE.right<Error, O.Option<OnProfileUpdateDocument>>(
        O.fromNullable((foundProfile as unknown) as OnProfileUpdateDocument)
      )
  )
);

export const profileRepositoryMock: ProfileRepository = {
  onProfileUpdateFindDocument: onProfileUpdateFindDocumentMock
};
