import "reflect-metadata";
import { DuplicateDecoratorError } from "./exceptions";
import { CompositeKeyGroup, DynamoEntityTarget } from "./types";
import {
  DYNAMO_TABLE_NAME_KEY,
  DYNAMO_PARTITION_KEY_KEY,
  DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
  DYNAMO_SORT_KEY_KEY,
  DYNAMO_INDEX_PARTITION_KEYS_KEY,
  DYNAMO_INDEX_SORT_KEYS_KEY,
  DYNAMO_COMPOSITE_SORT_KEY_KEY,
} from "./decorators";

/**
 * Helper function to get the constructor from a class or instance.
 */
export function getConstructor(target: DynamoEntityTarget): NewableFunction {
  return typeof target === "function" ? target : target.constructor;
}

/**
 * Helper function to get the prototype from a class or instance.
 */
export function getPrototype(target: DynamoEntityTarget): object {
  return getConstructor(target).prototype as object;
}

/**
 * Helper function to verify the duplicate existence of a unique decorator
 */
export function validateDuplicateDecorator(
  target: object,
  key: string,
  decoratorName: string,
  conflict: string | symbol,
) {
  const existingKey = Reflect.getMetadata(key, target) as string | undefined;
  if (existingKey !== undefined) {
    throw new DuplicateDecoratorError(
      `Multiple ${decoratorName} decorators found in class "${target.constructor?.name || "Unknown"}". ` +
        `Existing decorator: "${existingKey}", conflicting property: "${String(conflict)}"`,
    );
  }
}

/**
 * Validates that a string is not empty.
 */
export function validateNonEmptyString(value: string, paramName: string): void {
  if (value.trim() === "") {
    throw new Error(`Invalid ${paramName}: cannot be an empty string.`);
  }
}

/**
 * Retrieves the DynamoDB table name from a class that has been decorated with @DynamoTable.
 *
 * @param target - The class constructor or class instance
 * @returns The table name if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const tableName = getDynamoTableName(UserEntity);
 * // or
 * const tableName = getDynamoTableName(new UserEntity());
 * ```
 */
export function getDynamoTableName(
  target: DynamoEntityTarget,
): string | undefined {
  const constructor = getConstructor(target);
  return Reflect.getMetadata(DYNAMO_TABLE_NAME_KEY, constructor) as
    | string
    | undefined;
}

/**
 * Retrieves the partition key DynamoDB field name from a class that has a property decorated with @PartitionKey.
 *
 * @param target - The class constructor or class instance
 * @returns The partition key DynamoDB field name if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const partitionKey = getPartitionKeyName(UserEntity);
 * // or
 * const partitionKey = getPartitionKeyName(new UserEntity());
 * ```
 */
export function getPartitionKeyName(
  target: DynamoEntityTarget,
): string | undefined {
  const prototype = getPrototype(target);
  const simplePK = Reflect.getMetadata(DYNAMO_PARTITION_KEY_KEY, prototype) as
    | string
    | undefined;

  if (simplePK) return simplePK;

  const compositePK = Reflect.getMetadata(
    DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
    prototype,
  ) as CompositeKeyGroup | undefined;

  return compositePK?.name;
}

/**
 * Retrieves the sort key DynamoDB field name from a class that has a property decorated with @SortKey.
 *
 * @param target - The class constructor or class instance
 * @returns The sort key DynamoDB field name if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const sortKey = getSortKeyName(UserEntity);
 * // or
 * const sortKey = getSortKeyName(new UserEntity());
 * ```
 */
export function getSortKeyName(target: DynamoEntityTarget): string | undefined {
  const prototype = getPrototype(target);
  const simpleSK = Reflect.getMetadata(DYNAMO_SORT_KEY_KEY, prototype) as
    | string
    | undefined;

  if (simpleSK) return simpleSK;

  const compositeSK = Reflect.getMetadata(
    DYNAMO_COMPOSITE_SORT_KEY_KEY,
    prototype,
  ) as CompositeKeyGroup | undefined;

  return compositeSK?.name;
}

/**
 * Retrieves the partition key DynamoDB field name for a specific index from a class.
 *
 * @param target - The class constructor or class instance
 * @param indexName - The name of the DynamoDB index
 * @returns The partition key DynamoDB field name for the index if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const partitionKey = getIndexPartitionKeyName(UserEntity, "EmailIndex");
 * // or
 * const partitionKey = getIndexPartitionKeyName(new UserEntity(), "EmailIndex");
 * ```
 */
export function getIndexPartitionKeyName(
  target: DynamoEntityTarget,
  indexName: string,
): string | undefined {
  if (!indexName || indexName.trim() === "") {
    throw new Error("indexName cannot be empty");
  }
  const prototype = getPrototype(target);
  const indexKeys = Reflect.getMetadata(
    DYNAMO_INDEX_PARTITION_KEYS_KEY,
    prototype,
  ) as Record<string, string> | undefined;
  return indexKeys?.[indexName];
}

/**
 * Retrieves the sort key DynamoDB field name for a specific index from a class.
 *
 * @param target - The class constructor or class instance
 * @param indexName - The name of the DynamoDB index
 * @returns The sort key DynamoDB field name for the index if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const sortKey = getIndexSortKeyName(UserEntity, "EmailIndex");
 * // or
 * const sortKey = getIndexSortKeyName(new UserEntity(), "EmailIndex");
 * ```
 */
export function getIndexSortKeyName(
  target: DynamoEntityTarget,
  indexName: string,
): string | undefined {
  if (!indexName || indexName.trim() === "") {
    throw new Error("indexName cannot be empty");
  }
  const prototype = getPrototype(target);
  const indexKeys = Reflect.getMetadata(
    DYNAMO_INDEX_SORT_KEYS_KEY,
    prototype,
  ) as Record<string, string> | undefined;
  return indexKeys?.[indexName];
}

/**
 * Retrieves the composite partition key configuration for a specific composite key name.
 *
 * @param target - The class constructor or class instance
 * @returns Array of composite key fields ordered by position
 *
 * @example
 * ```typescript
 * const compositeKeyFields = getCompositePartitionKeyFields(UserEntity);
 * // Returns: ["orgId", "id"]
 * ```
 */
export function getCompositePartitionKeyFields(
  target: DynamoEntityTarget,
): string[] | undefined {
  const prototype = getPrototype(target);
  const compositeKey = Reflect.getMetadata(
    DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
    prototype,
  ) as CompositeKeyGroup | undefined;
  return compositeKey?.fields;
}

/**
 * Retrieves the composite sort key configuration for a specific composite key name.
 *
 * @param target - The class constructor or class instance
 * @returns Array of composite key fields ordered by position
 *
 * @example
 * ```typescript
 * const compositeKeyFields = getCompositeSortKeyFields(UserEntity);
 * // Returns: ["createdAt", "id"]
 * ```
 */
export function getCompositeSortKeyFields(
  target: DynamoEntityTarget,
): string[] | undefined {
  const prototype = getPrototype(target);
  const compositeKey = Reflect.getMetadata(
    DYNAMO_COMPOSITE_SORT_KEY_KEY,
    prototype,
  ) as CompositeKeyGroup | undefined;
  return compositeKey?.fields;
}
