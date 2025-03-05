import { beforeEach, describe, vi, it, expect } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import {
  IProfileEmailReader,
  IProfileEmailWriter,
  ProfileEmail,
  ProfileEmailWriterError
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { EmailString } from "@pagopa/ts-commons/lib/strings";
import { mockProfiles } from "../../functions/__mocks__/profile-repository.mock";
import { ProfileEmailRepository } from "../profile-emails";

const aProfileEmail: ProfileEmail = {
  fiscalCode: mockProfiles[0].fiscalCode,
  email: mockProfiles[0].email as NonNullable<EmailString>
};

const dataTableInsertMock = vi.fn().mockResolvedValue(void 0);
const dataTableDeleteMock = vi.fn().mockResolvedValue(void 0);

const dataTableMock = ({
  insert: dataTableInsertMock,
  delete: dataTableDeleteMock
} as unknown) as IProfileEmailWriter & IProfileEmailReader;

describe.each`
  kind             | isInsert
  ${"emailInsert"} | ${true}
  ${"emailDelete"} | ${false}
`("Profile email repository ($kind)", ({ isInsert }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed and return void on email emailInsert", async () => {
    const result = await ProfileEmailRepository[
      isInsert ? "emailInsert" : "emailDelete"
    ](aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should return error on a reject with Error", async () => {
    const anError = Error("unknown");

    if (isInsert) dataTableInsertMock.mockRejectedValueOnce(anError);
    else dataTableDeleteMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository[
      isInsert ? "emailInsert" : "emailDelete"
    ](aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(anError));
  });

  it("should return formatted error on a general reject", async () => {
    const anError = "unknown";
    const expectedError = Error(
      `error ${isInsert ? "inserting" : "deleting"} ProfileEmail ${
        isInsert ? "into" : "from"
      } table storage`
    );

    if (isInsert) dataTableInsertMock.mockRejectedValueOnce(anError);
    else dataTableDeleteMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository[
      isInsert ? "emailInsert" : "emailDelete"
    ](aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should succeed on DUPLICATE_ENTITY error", async () => {
    const aProfileWriterError: ProfileEmailWriterError = new ProfileEmailWriterError(
      "",
      isInsert ? "DUPLICATE_ENTITY" : "ENTITY_NOT_FOUND"
    );

    if (isInsert)
      dataTableInsertMock.mockRejectedValueOnce(aProfileWriterError);
    else dataTableDeleteMock.mockRejectedValueOnce(aProfileWriterError);

    const result = await ProfileEmailRepository[
      isInsert ? "emailInsert" : "emailDelete"
    ](aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });
});
