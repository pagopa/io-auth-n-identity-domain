import { RequiredQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_query_param";
import {
  IntegerFromString,
  NonNegativeInteger,
  WithinRangeInteger,
} from "@pagopa/ts-commons/lib/numbers";
import { tag, withDefault } from "@pagopa/ts-commons/lib/types";

import * as t from "io-ts";

export const PageSize = WithinRangeInteger(1, 100);
export type PageSize = t.TypeOf<typeof PageSize>;

const PAGE_SIZE_QUERY_PARAM_NAME = "page_size";
export const DEFAULT_PAGE_SIZE: PageSize = 25 as PageSize;

const PAGE_QUERY_PARAM_NAME = "page";
export const DEFAULT_PAGE = 1 as NonNegativeInteger;

export interface IPositiveIntegerTag {
  readonly kind: "IPositiveIntegerTag";
}

/**
 * Parses a string into a positive integer (>= 1)
 */
const PositiveIntegerFromString = tag<IPositiveIntegerTag>()(
  t.refinement(IntegerFromString, (i) => i >= 1, "PositiveIntegerFromString"),
);
type PositiveIntegerFromString = t.TypeOf<typeof PositiveIntegerFromString>;

export const PageSizeQueryMiddleware = RequiredQueryParamMiddleware(
  PAGE_SIZE_QUERY_PARAM_NAME,
  withDefault(WithinRangeInteger(1, 100), DEFAULT_PAGE_SIZE),
);

export const PageQueryMiddleware = RequiredQueryParamMiddleware(
  PAGE_QUERY_PARAM_NAME,
  withDefault(
    PositiveIntegerFromString,
    1 as unknown as PositiveIntegerFromString,
  ),
);
