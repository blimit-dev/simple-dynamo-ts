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
} from "./decorators";
import { DynamoKey, DynamoKeyMap, QueryOptions } from "./types";
import {
  DecoratorMissingError,
  InvalidParametersError,
  ItemNotFoundError,
} from "./exceptions";

export abstract class DynamoDBRepository<T> {
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly entityClass: NewableFunction,
  ) {}

  protected getTableName(): string {
    const tableName = getDynamoTableName(this.entityClass);
    if (!tableName) {
      throw new DecoratorMissingError(
        `Table name not found for entity class "${this.entityClass.name}". Make sure the class is decorated with @DynamoTable.`,
      );
    }
    return tableName;
  }

  protected getPKName(indexName?: string): string {
    let pkName: string | undefined = undefined;

    if (indexName)
      pkName = getIndexPartitionKeyName(this.entityClass, indexName);

    pkName = pkName ? pkName : getPartitionKeyName(this.entityClass);

    if (pkName) return pkName;

    throw new DecoratorMissingError(
      `Partition key not found for entity class "${this.entityClass.name}". Make sure a property is decorated with @PartitionKey.`,
    );
  }

  protected getSKName(indexName?: string): string | undefined {
    let skName: string | undefined = undefined;

    if (indexName) skName = getIndexSortKeyName(this.entityClass, indexName);

    return skName ? skName : getSortKeyName(this.entityClass);
  }

  /**
   * Builds a DynamoDB key object from partition key and optional sort key.
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
   */
  private buildCreateConditionExpression(skName?: string): string {
    //TODO fix validation for duplicate entity (email), now only passing orgId and id
    if (skName) {
      return `attribute_not_exists(#pk) AND attribute_not_exists(#sk)`;
    }
    return `attribute_not_exists(#pk)`;
  }

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

  async create(item: T): Promise<T> {
    if (!item) {
      throw new Error("Item cannot be null or undefined");
    }

    const tableName = this.getTableName();
    const partitionKey = this.getPKName();
    const sortKey = this.getSKName();
    const conditionExpression = this.buildCreateConditionExpression(sortKey);
    const expressionAttributeNames = this.buildExpressionAttributeNames(
      partitionKey,
      sortKey,
    );

    const command = new PutCommand({
      TableName: tableName,
      Item: item as Record<string, unknown>,
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

  async getItem(pk: DynamoKey, sk?: DynamoKey): Promise<T> {
    const tableName = this.getTableName();
    const key = this.buildKeyMap(pk, sk);

    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      if (response.Item) return response.Item as T;

      throw new ItemNotFoundError("Item not found in your DynamoDB Table!");
    } catch (error) {
      console.error("Error getting item from DynamoDB:", error);
      throw error;
    }
  }

  async put(item: T): Promise<T> {
    if (!item)
      throw new InvalidParametersError("Item cannot be null or undefined!");

    const command = new PutCommand({
      TableName: this.getTableName(),
      Item: item as Record<string, unknown>,
    });

    try {
      await this.client.send(command);
      return item;
    } catch (error) {
      console.error("Error putting item to DynamoDB:", error);
      throw error;
    }
  }

  async softDelete(pk: DynamoKey, sk?: DynamoKey): Promise<void> {
    const item = await this.getItem(pk, sk);
    (item as Record<string, unknown>)["deletedAt"] = new Date().toISOString();
    await this.put(item);
  }

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

  async query(
    options: QueryOptions,
  ): Promise<{ items: T[]; lastEvaluatedKey: T; count: number }> {
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
      return {
        items: response.Items as T[],
        lastEvaluatedKey: response.LastEvaluatedKey as T,
        count: response.Count ? response.Count : 0,
      };
    } catch (error) {
      console.error("Error querying items from DynamoDB:", error);
      throw error;
    }
  }

  /**
   * Builds the query expression components for DynamoDB queries.
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
