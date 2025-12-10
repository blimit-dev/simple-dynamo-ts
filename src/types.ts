export type QueryOptions = {
  pk: DynamoKey;
  sk?: DynamoKey;
  skComparator?: "=" | ">" | "<" | ">=" | "<=" | "BETWEEN" | "begins_with";
  indexName?: string;
  scanIndexForward?: boolean;
  limit?: number;
};

export type DynamoKey = string | number;
export type DynamoKeyMap = Record<string, DynamoKey>;

/**
 * Type alias for a class constructor or class instance that can be used with decorator helper functions.
 */
export type DynamoEntityTarget =
  | NewableFunction
  | { constructor: NewableFunction };
