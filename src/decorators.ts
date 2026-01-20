import "reflect-metadata";
import { DuplicateDecoratorError } from "./exceptions";
import { CompositeKeyGroup } from "./types";
import {
  validateNonEmptyString,
  validateDuplicateDecorator,
  getCompositePartitionKeyFields,
  getCompositeSortKeyFields,
} from "./helper-functions";

export const DYNAMO_TABLE_NAME_KEY = "dynamo:table:name";
export const DYNAMO_PARTITION_KEY_KEY = "dynamo:partition:key";
export const DYNAMO_SORT_KEY_KEY = "dynamo:sort:key";
export const DYNAMO_INDEX_PARTITION_KEYS_KEY = "dynamo:index:partition:keys";
export const DYNAMO_INDEX_SORT_KEYS_KEY = "dynamo:index:sort:keys";
export const DYNAMO_COMPOSITE_PARTITION_KEY_KEY =
  "dynamo:composite:partition:key";
export const DYNAMO_COMPOSITE_SORT_KEY_KEY = "dynamo:composite:sort:key";

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

    // Check if composite partition keys already exist
    const existingCompositeKeys = getCompositePartitionKeyFields(target);

    if (existingCompositeKeys && existingCompositeKeys.length > 0) {
      throw new DuplicateDecoratorError(
        `Cannot use @PartitionKey with @CompositePartitionKey in class "${target.constructor?.name || "Unknown"}". ` +
          `An entity can only have either a single @PartitionKey or multiple @CompositePartitionKey decorators, not both.`,
      );
    }

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
 * Decorator that marks a property as part of a composite partition key.
 * Multiple properties with the same pkName will be combined into a single partition key
 * using the order in which the decorators are applied.
 *
 * @param pkName - Optional. The name of the composite partition key group. If not provided, defaults to "pk".
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @CompositePartitionKey(0, "pk")
 *   orgId: string;
 *
 *   @CompositePartitionKey(1, "pk")
 *   userId: string;
 *
 *   // These will be combined into a single "pk" field in DynamoDB
 *   // as: "orgIdValue#userIdValue"
 * }
 * ```
 */
export function CompositePartitionKey(
  pkName: string = "pk",
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (pkName) {
      validateNonEmptyString(pkName, "pkName");
    }
    const fieldName = String(propertyKey);

    // Check if a regular partition key already exists
    const existingPartitionKey = Reflect.getMetadata(
      DYNAMO_PARTITION_KEY_KEY,
      target,
    ) as string | undefined;

    if (existingPartitionKey) {
      throw new DuplicateDecoratorError(
        `Cannot use @CompositePartitionKey with @PartitionKey in class "${target.constructor?.name || "Unknown"}". ` +
          `An entity can only have either a single @PartitionKey or multiple @CompositePartitionKey decorators, not both.`,
      );
    }

    const existingCompositeKeys = Reflect.getMetadata(
      DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
      target,
    ) as CompositeKeyGroup | undefined;

    if (!existingCompositeKeys) {
      Reflect.defineMetadata(
        DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
        { name: pkName, fields: [fieldName] },
        target,
      );
      return;
    }

    if (existingCompositeKeys.name !== pkName) {
      throw new DuplicateDecoratorError(
        `Cannot use multiple composite partition key groups in class "${target.constructor?.name || "Unknown"}". ` +
          `Existing composite key group: "${existingCompositeKeys.name}", conflicting group: "${pkName}". ` +
          `All @CompositePartitionKey decorators must use the same pkName.`,
      );
    }
    if (existingCompositeKeys.fields !== undefined) {
      if (existingCompositeKeys.fields.includes(fieldName)) {
        throw new DuplicateDecoratorError(
          `Property "${fieldName}" is already part of composite key "${pkName}" in class "${target.constructor?.name || "Unknown"}".`,
        );
      }
    }

    existingCompositeKeys.fields.push(fieldName);

    Reflect.defineMetadata(
      DYNAMO_COMPOSITE_PARTITION_KEY_KEY,
      existingCompositeKeys,
      target,
    );
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

    // Check if composite sort keys already exist
    const existingCompositeSortKeys = getCompositeSortKeyFields(target);

    if (existingCompositeSortKeys && existingCompositeSortKeys.length > 0) {
      throw new DuplicateDecoratorError(
        `Cannot use @SortKey with @CompositeSortKey in class "${target.constructor?.name || "Unknown"}". ` +
          `An entity can only have either a single @SortKey or multiple @CompositeSortKey decorators, not both.`,
      );
    }

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
 * Decorator that marks a property as part of a composite sort key.
 * Multiple properties with the same skName will be combined into a single sort key
 * using a deterministic order based on decorator application.
 *
 * @param skName - Optional. The name of the composite sort key group. If not provided, defaults to "sk".
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @DynamoTable("User")
 * export class UserEntity {
 *   @CompositeSortKey("sk")
 *   createdAt: string;
 *
 *   @CompositeSortKey("sk")
 *   id: string;
 *
 *   // These will be combined into a single "sk" field in DynamoDB
 *   // as: "createdAtValue#idValue"
 * }
 * ```
 */
export function CompositeSortKey(skName: string = "sk"): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (skName) {
      validateNonEmptyString(skName, "skName");
    }
    const fieldName = String(propertyKey);

    // Check if a regular sort key already exists
    const existingSortKey = Reflect.getMetadata(DYNAMO_SORT_KEY_KEY, target) as
      | string
      | undefined;

    if (existingSortKey) {
      throw new DuplicateDecoratorError(
        `Cannot use @CompositeSortKey with @SortKey in class "${target.constructor?.name || "Unknown"}". ` +
          `An entity can only have either a single @SortKey or multiple @CompositeSortKey decorators, not both.`,
      );
    }

    const existingCompositeKeys = Reflect.getMetadata(
      DYNAMO_COMPOSITE_SORT_KEY_KEY,
      target,
    ) as CompositeKeyGroup | undefined;

    if (!existingCompositeKeys) {
      Reflect.defineMetadata(
        DYNAMO_COMPOSITE_SORT_KEY_KEY,
        { name: skName, fields: [fieldName] },
        target,
      );
      return;
    }

    if (existingCompositeKeys.name !== skName) {
      throw new DuplicateDecoratorError(
        `Cannot use multiple composite sort key groups in class "${target.constructor?.name || "Unknown"}". ` +
          `Existing composite key group: "${existingCompositeKeys.name}", conflicting group: "${skName}". ` +
          `All @CompositeSortKey decorators must use the same skName.`,
      );
    }
    if (existingCompositeKeys.fields !== undefined) {
      if (existingCompositeKeys.fields.includes(fieldName)) {
        throw new DuplicateDecoratorError(
          `Property "${fieldName}" is already part of composite sort key "${skName}" in class "${target.constructor?.name || "Unknown"}".`,
        );
      }
    }

    existingCompositeKeys.fields.push(fieldName);

    Reflect.defineMetadata(
      DYNAMO_COMPOSITE_SORT_KEY_KEY,
      existingCompositeKeys,
      target,
    );
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
//TODO add uniqueness possibility
//TODO add updatedAt, createdAt, deletedAt automatic fields
//TODO add table creation/update via entity like ORMs
