import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  getDynamoTableName,
  getPartitionKeyName,
  getSortKeyName,
  getIndexPartitionKeyName,
  getIndexSortKeyName,
  getCompositePartitionKeyFields,
} from "./decorators";
import { DynamoKey, DynamoKeyMap, QueryOptions } from "./types";
import {
  DecoratorMissingError,
  InvalidParametersError,
  ItemNotFoundError,
} from "./exceptions";

export abstract class DynamoDBRepository<T> {
  private readonly COMPOSITE_KEY_DELIMITER = "#";

  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly entityClass: NewableFunction,
  ) {}

  /**
   * Gets the DynamoDB table name for the entity.
   * @returns Table name
   * @throws {DecoratorMissingError} If table name is not found
   */
  protected getTableName(): string {
    const tableName = getDynamoTableName(this.entityClass);
    if (!tableName) {
      throw new DecoratorMissingError(
        `Table name not found for entity class "${this.entityClass.name}". Make sure the class is decorated with @DynamoTable.`,
      );
    }
    return tableName;
  }

  /**
   * Gets the partition key name for the entity, optionally from a specific index.
   * @param indexName - Optional index name to get partition key from
   * @returns Partition key name
   * @throws {DecoratorMissingError} If no partition key is found
   */
  protected getPKName(indexName?: string): string {
    if (indexName) {
      const indexPkName = getIndexPartitionKeyName(this.entityClass, indexName);
      if (indexPkName) return indexPkName;
    }

    const pkName = getPartitionKeyName(this.entityClass);
    if (pkName) return pkName;

    throw new DecoratorMissingError(
      `Partition key not found for entity class "${this.entityClass.name}". Make sure a property is decorated with @PartitionKey or @CompositePartitionKey.`,
    );
  }

  /**
   * Checks if the entity uses a composite partition key.
   * @returns True if composite partition key is configured, false otherwise
   */
  protected isCompositePartitionKey() {
    return getCompositePartitionKeyFields(this.entityClass) !== undefined;
  }

  /**
   * Gets the sort key name for the entity, optionally from a specific index.
   * @param indexName - Optional index name to get sort key from
   * @returns Sort key name or undefined if no sort key is configured
   */
  protected getSKName(indexName?: string): string | undefined {
    let skName: string | undefined = undefined;

    if (indexName) skName = getIndexSortKeyName(this.entityClass, indexName);

    return skName ? skName : getSortKeyName(this.entityClass);
  }

  /**
   * Builds a composite partition key from entity properties.
   * @param item - The entity item containing properties
   * @param pkName - Optional. The name of the composite partition key group.
   * @returns The composite key string or undefined if no composite keys exist
   */
  protected buildCompositeKey(item: T): string | undefined {
    const compositeKeys = getCompositePartitionKeyFields(this.entityClass);
    if (!compositeKeys || compositeKeys.length === 0) return undefined;

    const itemRecord = item as Record<string, unknown>;
    const keyValues: string[] = compositeKeys.map((key) =>
      this.convertValueToString(itemRecord[key]),
    );
    return keyValues.join(this.COMPOSITE_KEY_DELIMITER);
  }

  /**
   * Converts a value to string format, handling Date objects specially.
   * @param value - The value to convert
   * @returns String representation of the value
   */
  private convertValueToString(value: unknown) {
    return value instanceof Date ? value.toISOString() : String(value);
  }

  /**
   * Transforms an item before saving to DynamoDB by composing composite keys.
   * @param item - The entity item
   * @returns The transformed item ready for DynamoDB
   */
  protected transformItemForSave(item: T): Record<string, unknown> {
    const itemRecord = { ...(item as Record<string, unknown>) };
    const compositeKeys = getCompositePartitionKeyFields(this.entityClass);

    if (compositeKeys !== undefined) {
      const pk = this.buildCompositeKey(item);
      itemRecord[this.getPKName()] = pk;
      compositeKeys.forEach((key) => delete itemRecord[key]);
    }

    return itemRecord;
  }

  /**
   * Builds a DynamoDB key object from partition key and optional sort key.
   * @param pk - Partition key value
   * @param sk - Optional sort key value
   * @returns DynamoKeyMap object suitable for DynamoDB operations
   * @throws {DecoratorMissingError} If sort key is provided but not configured
   */
  protected buildKeyMap(pk: DynamoKey, sk?: DynamoKey): DynamoKeyMap {
    const partitionKey = this.getPKName();
    const keys: DynamoKeyMap = { [partitionKey]: pk };

    if (sk !== undefined) {
      const sortKey = this.getSKName();
      if (!sortKey) {
        throw new DecoratorMissingError(
          `Sort key provided but entity class "${this.entityClass.name}" does not have a sort key defined. Make sure a property is decorated with @SortKey.`,
        );
      }
      keys[sortKey] = sk;
    }

    return keys;
  }

  /**
   * Builds a condition expression for preventing duplicate items on create.
   * Checks that both partition key and sort key (if present) don't already exist.
   * @param skName - Optional sort key name
   * @returns Condition expression string for DynamoDB PutCommand
   */
  private buildCreateConditionExpression(skName?: string): string {
    if (skName) {
      return `attribute_not_exists(#pk) AND attribute_not_exists(#sk)`;
    }
    return `attribute_not_exists(#pk)`;
  }

  /**
   * Builds expression attribute names for DynamoDB condition expressions.
   * @param pkName - Partition key name
   * @param skName - Optional sort key name
   * @returns Record mapping expression placeholders to actual attribute names
   */
  private buildExpressionAttributeNames(
    pkName: string,
    skName?: string,
  ): Record<string, string> {
    const expressionAttributeNames: Record<string, string> = {
      "#pk": pkName,
    };

    if (skName) expressionAttributeNames["#sk"] = skName;

    return expressionAttributeNames;
  }

  /**
   * Creates a new item in DynamoDB with a condition that prevents duplicates.
   * Throws an error if an item with the same key already exists.
   * @param item - The entity item to create
   * @returns Promise resolving to the created item
   * @throws {InvalidParametersError} If item is null or undefined
   * @throws {Error} If item already exists or DynamoDB operation fails
   */
  async create(item: T): Promise<T> {
    if (!item) {
      throw new InvalidParametersError("Item cannot be null or undefined");
    }

    const tableName = this.getTableName();
    const partitionKey = this.getPKName();
    const sortKey = this.getSKName();
    const conditionExpression = this.buildCreateConditionExpression(sortKey);
    const expressionAttributeNames = this.buildExpressionAttributeNames(
      partitionKey,
      sortKey,
    );

    const transformedItem = this.transformItemForSave(item);

    const command = new PutCommand({
      TableName: tableName,
      Item: transformedItem,
      ConditionExpression: conditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
    });

    try {
      await this.client.send(command);
      return item;
    } catch (error) {
      console.error("Error creating item in DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Retrieves a single item from DynamoDB by partition key and optional sort key.
   * @param pk - Partition key value
   * @param sk - Optional sort key value
   * @returns Promise resolving to the retrieved entity
   * @throws {ItemNotFoundError} If the item does not exist
   * @throws {Error} If DynamoDB operation fails
   */
  async getItem(pk: DynamoKey, sk?: DynamoKey): Promise<T> {
    const tableName = this.getTableName();
    const key = this.buildKeyMap(pk, sk);

    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      if (response.Item) {
        return this.convertDynamoItemToEntity(
          response.Item as Record<string, unknown>,
        );
      }

      throw new ItemNotFoundError("Item not found in your DynamoDB Table!");
    } catch (error) {
      console.error("Error getting item from DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Converts a DynamoDB item to an entity by expanding composite partition keys.
   * Splits composite keys back into individual properties.
   * @param item - The DynamoDB item record
   * @returns The entity object with expanded composite keys
   */
  protected convertDynamoItemToEntity(item: Record<string, unknown>) {
    const entity = { ...item };
    const compositeKeys = getCompositePartitionKeyFields(this.entityClass);

    if (compositeKeys !== undefined) {
      const pkName = this.getPKName();
      const pks = (entity[pkName] as string).split(
        this.COMPOSITE_KEY_DELIMITER,
      );
      compositeKeys.forEach((key, index) => (entity[key] = pks[index]));
      delete entity[pkName];
    }
    return entity as T;
  }

  /**
   * Puts (creates or updates) an item in DynamoDB without duplicate checking.
   * Use this method when you want to overwrite existing items.
   * @param item - The entity item to put
   * @returns Promise resolving to the put item
   * @throws {InvalidParametersError} If item is null or undefined
   * @throws {Error} If DynamoDB operation fails
   */
  async put(item: T): Promise<T> {
    if (!item)
      throw new InvalidParametersError("Item cannot be null or undefined!");

    // Transform item for save (compose composite keys)
    const transformedItem = this.transformItemForSave(item);

    const command = new PutCommand({
      TableName: this.getTableName(),
      Item: transformedItem,
    });

    try {
      await this.client.send(command);
      return item;
    } catch (error) {
      console.error("Error putting item to DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Performs a soft delete by setting a deletedAt timestamp on the item.
   * The item remains in DynamoDB but is marked as deleted.
   * @param pk - Partition key value
   * @param sk - Optional sort key value
   * @throws {ItemNotFoundError} If the item does not exist
   * @throws {Error} If DynamoDB operation fails
   */
  async softDelete(pk: DynamoKey, sk?: DynamoKey): Promise<void> {
    const item = await this.getItem(pk, sk);
    (item as Record<string, unknown>)["deletedAt"] = new Date().toISOString();
    await this.put(item);
  }

  /**
   * Permanently deletes an item from DynamoDB.
   * @param pk - Partition key value
   * @param sk - Optional sort key value
   * @throws {Error} If DynamoDB operation fails
   */
  async remove(pk: DynamoKey, sk?: DynamoKey): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.getTableName(),
      Key: this.buildKeyMap(pk, sk),
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error("Error deleting item from DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Queries items from DynamoDB based on partition key and optional sort key.
   * @param options - Query options including partition key, sort key, comparator, index name, and pagination
   * @returns Promise resolving to an object containing items array, lastEvaluatedKey for pagination, and count
   */
  async query(options: QueryOptions): Promise<{
    items: T[];
    lastEvaluatedKey: DynamoKeyMap | undefined;
    count: number;
  }> {
    const {
      pk,
      sk,
      skComparator = "=",
      indexName,
      scanIndexForward = true,
      limit,
    } = options;

    const tableName = this.getTableName();
    const pkName = this.getPKName(indexName);
    const skName = sk !== undefined ? this.getSKName(indexName) : undefined;

    if (sk !== undefined && !skName) {
      throw new DecoratorMissingError(
        `Sort key provided but no sort key found in entity class "${this.entityClass.name}". Make sure a property is decorated with @SortKey or @IndexSortKey.`,
      );
    }

    const {
      keyConditionExpression,
      expressionAttributeNames,
      expressionAttributeValues,
    } = this.buildQueryExpressions(pk, pkName, sk, skName, skComparator);

    const commandInput: QueryCommandInput = {
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ScanIndexForward: scanIndexForward,
    };

    try {
      const response = await this.client.send(new QueryCommand(commandInput));

      const transformedItems = response.Items
        ? (response.Items as Record<string, unknown>[]).map((item) =>
            this.convertDynamoItemToEntity(item),
          )
        : [];

      return {
        items: transformedItems,
        lastEvaluatedKey: response.LastEvaluatedKey as DynamoKeyMap | undefined,
        count: response.Count ? response.Count : 0,
      };
      //TODO: test lastEvaluatedKey response format
    } catch (error) {
      console.error("Error querying items from DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Builds the query expression components for DynamoDB queries.
   * Constructs key condition expression, expression attribute names, and values.
   * @param pk - Partition key value
   * @param pkName - Partition key attribute name
   * @param sk - Optional sort key value
   * @param skName - Optional sort key attribute name
   * @param skComparator - Optional sort key comparison operator (=, >, <, >=, <=, BETWEEN, begins_with)
   * @returns Object containing keyConditionExpression, expressionAttributeNames, and expressionAttributeValues
   */
  protected buildQueryExpressions(
    pk: DynamoKey,
    pkName: string,
    sk?: DynamoKey,
    skName?: string,
    skComparator?: string,
  ): {
    keyConditionExpression: string;
    expressionAttributeNames: Record<string, string>;
    expressionAttributeValues: Record<string, string | number>;
  } {
    const expressionAttributeNames: Record<string, string> = { "#pk": pkName };
    const expressionAttributeValues: Record<string, string | number> = {
      ":pkValue": pk,
    };

    let keyConditionExpression = "#pk = :pkValue";

    if (sk !== undefined && skName) {
      const skComparisonString =
        skComparator === "begins_with"
          ? "begins_with(#sk, :skValue)"
          : `#sk ${skComparator} :skValue`;

      keyConditionExpression = `${keyConditionExpression} AND ${skComparisonString}`;
      expressionAttributeNames["#sk"] = skName;
      expressionAttributeValues[":skValue"] = sk;
    }

    return {
      keyConditionExpression,
      expressionAttributeNames,
      expressionAttributeValues,
    };
  }
}
