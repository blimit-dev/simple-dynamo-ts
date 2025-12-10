import "reflect-metadata";
import { DuplicateDecoratorError } from "./exceptions";
import { DynamoEntityTarget } from "./types";

export const DYNAMO_TABLE_NAME_KEY = "dynamo:table:name";
export const DYNAMO_PARTITION_KEY_KEY = "dynamo:partition:key";
export const DYNAMO_SORT_KEY_KEY = "dynamo:sort:key";
export const DYNAMO_INDEX_PARTITION_KEYS_KEY = "dynamo:index:partition:keys";
export const DYNAMO_INDEX_SORT_KEYS_KEY = "dynamo:index:sort:keys";

/**
 * Helper function to get the constructor from a class or instance.
 */
function getConstructor(target: DynamoEntityTarget): NewableFunction {
  return typeof target === "function" ? target : target.constructor;
}

/**
 * Helper function to get the prototype from a class or instance.
 */
function getPrototype(target: DynamoEntityTarget): object {
  return getConstructor(target).prototype as object;
}

/**
 * Helper function to verify the duplicate existence of a unique decorator
 */
function validateDuplicateDecorator(
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
function validateNonEmptyString(value: string, paramName: string): void {
  if (value.trim() === "") {
    throw new Error(`Invalid ${paramName}: cannot be an empty string.`);
  }
}

/**
 * Decorator that adds a DynamoDB table name to the annotated class.
 * The table name can be retrieved using the getDynamoTableName helper function.
 *
 * @param tableName - Optional. The name of the DynamoDB table. If not provided, the class name will be used.
 * @returns A class decorator function
 *
 * @example
 * ```typescript
 * // Explicitly specify the table name
 * @DynamoTable("User")
 * export class UserEntity {
 *   // class implementation
 * }
 *
 * // Or use class name as table name
 * @DynamoTable()
 * export class UserEntity {
 *   // class implementation - table name will be "UserEntity"
 * }
 * ```
 */
export function DynamoTable(tableName?: string): ClassDecorator {
  return function (target: NewableFunction) {
    if (tableName) {
      validateNonEmptyString(tableName, "tableName");
    }
    const dynamoTableName = tableName ?? target.name;
    validateDuplicateDecorator(
      target,
      DYNAMO_TABLE_NAME_KEY,
      "@DynamoTable",
      dynamoTableName,
    );
    Reflect.defineMetadata(DYNAMO_TABLE_NAME_KEY, dynamoTableName, target);
  };
}

/**
 * Decorator that marks a property as the DynamoDB partition key (HASH key).
 * The partition key DynamoDB field name can be retrieved using the getPartitionKeyName helper function.
 *
 * @param fieldName - Optional. The name of the field in DynamoDB. If not provided, the property name will be used.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @PartitionKey("type")
 *   type: string = "USER";
 *   // or use property name as field name
 *   @PartitionKey()
 *   type: string = "USER";
 * }
 * ```
 */
export function PartitionKey(fieldName?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (fieldName) {
      validateNonEmptyString(fieldName, "fieldName");
    }
    const dynamoFieldName = fieldName ?? String(propertyKey);

    validateDuplicateDecorator(
      target,
      DYNAMO_PARTITION_KEY_KEY,
      "@PartitionKey",
      dynamoFieldName,
    );
    Reflect.defineMetadata(DYNAMO_PARTITION_KEY_KEY, dynamoFieldName, target);
  };
}

/**
 * Decorator that marks a property as the DynamoDB sort key (RANGE key).
 * The sort key DynamoDB field name can be retrieved using the getSortKeyName helper function.
 *
 * @param fieldName - Optional. The name of the field in DynamoDB. If not provided, the property name will be used.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @PartitionKey("type")
 *   type: string = "USER";
 *   @SortKey("id")
 *   id: string = uuidv4();
 *   // or use property names as field names
 *   @SortKey()
 *   id: string = uuidv4();
 * }
 * ```
 */
export function SortKey(fieldName?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (fieldName) {
      validateNonEmptyString(fieldName, "fieldName");
    }
    const dynamoFieldName = fieldName ?? String(propertyKey);

    validateDuplicateDecorator(
      target,
      DYNAMO_SORT_KEY_KEY,
      "@SortKey",
      propertyKey,
    );
    Reflect.defineMetadata(DYNAMO_SORT_KEY_KEY, dynamoFieldName, target);
  };
}

/**
 * Decorator that marks a property as a partition key (HASH key) for a DynamoDB index.
 * The index partition key field name can be retrieved using the getIndexPartitionKeyName helper function.
 *
 * @param indexName - Required. The name of the DynamoDB index.
 * @param fieldName - Optional. The name of the field in DynamoDB. If not provided, the property name will be used.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @PartitionKey("type")
 *   type: string = "USER";
 *   @SortKey("id")
 *   id: string = uuidv4();
 *
 *   @IndexPartitionKey("EmailIndex", "type")
 *   type: string = "USER";
 *
 *   @IndexSortKey("EmailIndex", "email")
 *   email: string;
 * }
 * ```
 */
export function IndexPartitionKey(
  indexName: string,
  fieldName?: string,
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    validateNonEmptyString(indexName, "indexName");
    if (fieldName) {
      validateNonEmptyString(fieldName, "fieldName");
    }
    const dynamoFieldName = fieldName ?? String(propertyKey);

    const existingKeys =
      (Reflect.getMetadata(DYNAMO_INDEX_PARTITION_KEYS_KEY, target) as
        | Record<string, string>
        | undefined) ?? {};
    if (existingKeys[indexName] !== undefined) {
      throw new DuplicateDecoratorError(
        `Multiple @IndexPartitionKey decorators found for index "${indexName}" in class "${target.constructor?.name || "Unknown"}". ` +
          `Existing partition key: "${existingKeys[indexName]}", conflicting property: "${String(propertyKey)}"`,
      );
    }
    existingKeys[indexName] = dynamoFieldName;
    Reflect.defineMetadata(
      DYNAMO_INDEX_PARTITION_KEYS_KEY,
      existingKeys,
      target,
    );
  };
}

/**
 * Decorator that marks a property as a sort key (RANGE key) for a DynamoDB index.
 * The index sort key field name can be retrieved using the getIndexSortKeyName helper function.
 *
 * @param indexName - Required. The name of the DynamoDB index.
 * @param fieldName - Optional. The name of the field in DynamoDB. If not provided, the property name will be used.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @PartitionKey("type")
 *   type: string = "USER";
 *   @SortKey("id")
 *   id: string = uuidv4();
 *
 *   @IndexPartitionKey("EmailIndex", "type")
 *   type: string = "USER";
 *
 *   @IndexSortKey("EmailIndex", "email")
 *   email: string;
 * }
 * ```
 */
export function IndexSortKey(
  indexName: string,
  fieldName?: string,
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    validateNonEmptyString(indexName, "indexName");
    if (fieldName) {
      validateNonEmptyString(fieldName, "fieldName");
    }
    const dynamoFieldName = fieldName ?? String(propertyKey);

    const existingKeys =
      (Reflect.getMetadata(DYNAMO_INDEX_SORT_KEYS_KEY, target) as
        | Record<string, string>
        | undefined) ?? {};
    if (existingKeys[indexName] !== undefined) {
      throw new DuplicateDecoratorError(
        `Multiple @IndexSortKey decorators found for index "${indexName}" in class "${target.constructor?.name || "Unknown"}". ` +
          `Existing sort key: "${existingKeys[indexName]}", conflicting property: "${String(propertyKey)}"`,
      );
    }
    existingKeys[indexName] = dynamoFieldName;
    Reflect.defineMetadata(DYNAMO_INDEX_SORT_KEYS_KEY, existingKeys, target);
  };
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
  return Reflect.getMetadata(DYNAMO_PARTITION_KEY_KEY, prototype) as
    | string
    | undefined;
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
  return Reflect.getMetadata(DYNAMO_SORT_KEY_KEY, prototype) as
    | string
    | undefined;
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
//TODO add uniqueness possibility
//TODO add updatedAt, createdAt, deletedAt automatic fields
//TODO add table creation/update via entity like ORMs
