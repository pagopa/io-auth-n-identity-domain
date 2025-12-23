import { RequiredQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_query_param";
import {
  IntegerFromString,
  WithinRangeInteger,
} from "@pagopa/ts-commons/lib/numbers";
import { tag, withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

/**
 * Parses a string into a positive integer (>= 1)
 */
export const PositiveIntegerFromString = tag<IPositiveIntegerTag>()(
  t.refinement(IntegerFromString, (i) => i >= 1, "PositiveIntegerFromString"),
);
export type PositiveIntegerFromString = t.TypeOf<typeof PositiveIntegerFromString>;

export const PageSize = WithinRangeInteger(1, 101);
export type PageSize = t.TypeOf<typeof PageSize>;

const PAGE_SIZE_QUERY_PARAM_NAME = "page_size";
export const DEFAULT_PAGE_SIZE = 25;
const PAGE_QUERY_PARAM_NAME = "page";
export const DEFAULT_PAGE = 1;

export interface IPositiveIntegerTag {
  readonly kind: "IPositiveIntegerTag";
}

export const PageSizeQueryMiddleware = RequiredQueryParamMiddleware(
  PAGE_SIZE_QUERY_PARAM_NAME,
  withDefault(t.string, DEFAULT_PAGE_SIZE.toString()).pipe(
    IntegerFromString.pipe(PageSize),
  ),
);

export const PageQueryMiddleware = RequiredQueryParamMiddleware(
  PAGE_QUERY_PARAM_NAME,
  withDefault(t.string, DEFAULT_PAGE.toString()).pipe(
    PositiveIntegerFromString,
  ),
);
