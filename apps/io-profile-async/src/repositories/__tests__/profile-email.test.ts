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

describe("Profile email repository (emailInsert)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed and return void on emailInsert", async () => {
    const result = await ProfileEmailRepository.emailInsert(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should return error on a reject with Error", async () => {
    const anError = Error("unknown");

    dataTableInsertMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository.emailInsert(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(anError));
  });

  it("should return formatted error on a general reject", async () => {
    const anError = "unknown";
    const expectedError = Error(
      `error inserting ProfileEmail into table storage`
    );

    dataTableInsertMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository.emailInsert(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should succeed on DUPLICATE_ENTITY error", async () => {
    const aProfileWriterError: ProfileEmailWriterError = new ProfileEmailWriterError(
      "",
      "DUPLICATE_ENTITY"
    );

    dataTableInsertMock.mockRejectedValueOnce(aProfileWriterError);

    const result = await ProfileEmailRepository.emailInsert(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("Profile email repository (emailDelete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed and return void on emailDelete", async () => {
    const result = await ProfileEmailRepository.emailDelete(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should return error on a reject with Error", async () => {
    const anError = Error("unknown");

    dataTableDeleteMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository.emailDelete(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(anError));
  });

  it("should return formatted error on a general reject", async () => {
    const anError = "unknown";
    const expectedError = Error(
      `error deleting ProfileEmail from table storage`
    );

    dataTableDeleteMock.mockRejectedValueOnce(anError);

    const result = await ProfileEmailRepository.emailDelete(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeFalsy();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should succeed on DUPLICATE_ENTITY error", async () => {
    const aProfileWriterError: ProfileEmailWriterError = new ProfileEmailWriterError(
      "",
      "ENTITY_NOT_FOUND"
    );

    dataTableDeleteMock.mockRejectedValueOnce(aProfileWriterError);

    const result = await ProfileEmailRepository.emailDelete(aProfileEmail)({
      dataTableProfileEmailsRepository: dataTableMock
    })();

    expect(E.isRight(result)).toBeTruthy();
  });
});
