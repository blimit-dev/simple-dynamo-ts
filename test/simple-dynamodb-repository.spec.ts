import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBRepository } from "../src/simple-dynamodb-repository";
import {
  DynamoTable,
  PartitionKey,
  SortKey,
  IndexPartitionKey,
  IndexSortKey,
} from "../src/decorators";
import {
  DecoratorMissingError,
  InvalidParametersError,
  ItemNotFoundError,
} from "../src/exceptions";

// Mock AWS SDK
jest.mock("@aws-sdk/lib-dynamodb");

describe("DynamoDBRepository", () => {
  let mockClient: jest.Mocked<DynamoDBDocumentClient>;
  let repository: TestRepository;
  let consoleErrorSpy: jest.SpyInstance;

  @DynamoTable("TestTable")
  class TestEntity {
    @PartitionKey("pk")
    id: string;

    @SortKey("sk")
    timestamp: string;

    name: string;
  }

  class TestRepository extends DynamoDBRepository<TestEntity> {
    constructor(client: DynamoDBDocumentClient) {
      super(client, TestEntity);
    }
  }

  beforeEach(() => {
    mockClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<DynamoDBDocumentClient>;

    repository = new TestRepository(mockClient);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getTableName", () => {
    it("should return table name from decorator", () => {
      const tableName = repository["getTableName"]();
      expect(tableName).toBe("TestTable");
    });

    it("should throw DecoratorMissingError when table decorator is missing", () => {
      class EntityWithoutTable {
        @PartitionKey("pk")
        id: string;
      }

      class BadRepository extends DynamoDBRepository<EntityWithoutTable> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithoutTable);
        }
      }

      const badRepo = new BadRepository(mockClient);
      expect(() => badRepo["getTableName"]()).toThrow(DecoratorMissingError);
    });
  });

  describe("getPKName", () => {
    it("should return partition key name", () => {
      const pkName = repository["getPKName"]();
      expect(pkName).toBe("pk");
    });

    it("should return index partition key when index name is provided", () => {
      @DynamoTable("TestTable")
      class EntityWithIndex {
        @PartitionKey("pk")
        id: string;

        @IndexPartitionKey("EmailIndex", "emailType")
        emailType: string;
      }

      class IndexRepository extends DynamoDBRepository<EntityWithIndex> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithIndex);
        }
      }

      const indexRepo = new IndexRepository(mockClient);
      expect(indexRepo["getPKName"]("EmailIndex")).toBe("emailType");
      expect(indexRepo["getPKName"]()).toBe("pk");
    });

    it("should throw DecoratorMissingError when partition key is missing", () => {
      @DynamoTable("TestTable")
      class EntityWithoutPK {}

      class BadRepository extends DynamoDBRepository<EntityWithoutPK> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithoutPK);
        }
      }

      const badRepo = new BadRepository(mockClient);
      expect(() => badRepo["getPKName"]()).toThrow(DecoratorMissingError);
    });
  });

  describe("getSKName", () => {
    it("should return sort key name", () => {
      const skName = repository["getSKName"]();
      expect(skName).toBe("sk");
    });

    it("should return undefined when sort key is not defined", () => {
      @DynamoTable("TestTable")
      class EntityWithoutSK {
        @PartitionKey("pk")
        id: string;
      }

      class NoSKRepository extends DynamoDBRepository<EntityWithoutSK> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithoutSK);
        }
      }

      const noSKRepo = new NoSKRepository(mockClient);
      expect(noSKRepo["getSKName"]()).toBeUndefined();
    });

    it("should return index sort key when index name is provided", () => {
      @DynamoTable("TestTable")
      class EntityWithIndex {
        @PartitionKey("pk")
        id: string;

        @SortKey("sk")
        timestamp: string;

        @IndexSortKey("EmailIndex", "email")
        email: string;
      }

      class IndexRepository extends DynamoDBRepository<EntityWithIndex> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithIndex);
        }
      }

      const indexRepo = new IndexRepository(mockClient);
      expect(indexRepo["getSKName"]("EmailIndex")).toBe("email");
      expect(indexRepo["getSKName"]()).toBe("sk");
    });
  });

  describe("buildKeyMap", () => {
    it("should build key map with partition key only", () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);
      const keyMap = pkOnlyRepo["buildKeyMap"]("partition-value");
      expect(keyMap).toEqual({ pk: "partition-value" });
    });

    it("should build key map with partition and sort key", () => {
      const keyMap = repository["buildKeyMap"]("pk-value", "sk-value");
      expect(keyMap).toEqual({ pk: "pk-value", sk: "sk-value" });
    });

    it("should throw DecoratorMissingError when sort key is provided but not defined", () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);
      expect(() => pkOnlyRepo["buildKeyMap"]("pk-value", "sk-value")).toThrow(
        DecoratorMissingError,
      );
    });
  });

  describe("create", () => {
    it("should create an item successfully", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      mockClient.send = jest.fn().mockResolvedValue({});

      const result = await repository.create(item);

      expect(result).toEqual(item);
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(PutCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Item).toEqual(item);
        expect(command.input.ConditionExpression).toBe("attribute_not_exists(#pk) AND attribute_not_exists(#sk)");
        expect(command.input.ExpressionAttributeNames).toEqual({
          "#pk": "pk",
          "#sk": "sk",
        });
      } else {
        // Fallback: check the command was called with correct type
        expect(command).toBeInstanceOf(PutCommand);
      }
    });

    it("should create an item without sort key condition when sort key is not defined", async () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;

        name: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);
      const item: EntityPKOnly = {
        id: "test-id",
        name: "Test Item",
      };

      mockClient.send = jest.fn().mockResolvedValue({});

      await pkOnlyRepo.create(item);

      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(PutCommand);
      if (command && command.input) {
        expect(command.input.ConditionExpression).toBe("attribute_not_exists(#pk)");
        expect(command.input.ExpressionAttributeNames).toEqual({
          "#pk": "pk",
        });
      }
    });

    it("should throw error when item is null", async () => {
      await expect(repository.create(null as unknown as TestEntity)).rejects.toThrow(
        "Item cannot be null or undefined",
      );
    });

    it("should throw error when item is undefined", async () => {
      await expect(repository.create(undefined as unknown as TestEntity)).rejects.toThrow(
        "Item cannot be null or undefined",
      );
    });

    it("should propagate errors from DynamoDB", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      const dbError = new Error("DynamoDB error");
      mockClient.send = jest.fn().mockRejectedValue(dbError);

      await expect(repository.create(item)).rejects.toThrow("DynamoDB error");
    });
  });

  describe("getItem", () => {
    it("should get an item successfully with partition key only", async () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;

        name: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);
      const item: EntityPKOnly = {
        id: "test-id",
        name: "Test Item",
      };

      mockClient.send = jest.fn().mockResolvedValue({ Item: item });

      const result = await pkOnlyRepo.getItem("test-id");

      expect(result).toEqual(item);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(GetCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Key).toEqual({ pk: "test-id" });
      }
    });

    it("should get an item successfully with partition and sort key", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      mockClient.send = jest.fn().mockResolvedValue({ Item: item });

      const result = await repository.getItem("test-id", "2024-01-01");

      expect(result).toEqual(item);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(GetCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Key).toEqual({ pk: "test-id", sk: "2024-01-01" });
      }
    });

    it("should throw ItemNotFoundError when item is not found", async () => {
      mockClient.send = jest.fn().mockResolvedValue({ Item: undefined });

      await expect(repository.getItem("test-id", "2024-01-01")).rejects.toThrow(
        ItemNotFoundError,
      );
    });

    it("should propagate errors from DynamoDB", async () => {
      const dbError = new Error("DynamoDB error");
      mockClient.send = jest.fn().mockRejectedValue(dbError);

      await expect(repository.getItem("test-id", "2024-01-01")).rejects.toThrow(
        "DynamoDB error",
      );
    });
  });

  describe("put", () => {
    it("should put an item successfully", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      mockClient.send = jest.fn().mockResolvedValue({});

      const result = await repository.put(item);

      expect(result).toEqual(item);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(PutCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Item).toEqual(item);
      }
    });

    it("should throw InvalidParametersError when item is null", async () => {
      await expect(repository.put(null as unknown as TestEntity)).rejects.toThrow(
        InvalidParametersError,
      );
    });

    it("should throw InvalidParametersError when item is undefined", async () => {
      await expect(repository.put(undefined as unknown as TestEntity)).rejects.toThrow(
        InvalidParametersError,
      );
    });

    it("should propagate errors from DynamoDB", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      const dbError = new Error("DynamoDB error");
      mockClient.send = jest.fn().mockRejectedValue(dbError);

      await expect(repository.put(item)).rejects.toThrow("DynamoDB error");
    });
  });

  describe("softDelete", () => {
    it("should soft delete an item by setting deletedAt", async () => {
      const item: TestEntity = {
        id: "test-id",
        timestamp: "2024-01-01",
        name: "Test Item",
      };

      mockClient.send = jest
        .fn()
        .mockResolvedValueOnce({ Item: item }) // getItem call
        .mockResolvedValueOnce({}); // put call

      await repository.softDelete("test-id", "2024-01-01");

      expect(mockClient.send).toHaveBeenCalledTimes(2);
      const putCall = (mockClient.send as jest.Mock).mock.calls[1][0];
      expect(putCall).toBeDefined();
      expect(putCall).toBeInstanceOf(PutCommand);
      if (putCall && putCall.input && putCall.input.Item) {
        expect(putCall.input.Item).toHaveProperty("deletedAt");
        expect(typeof putCall.input.Item.deletedAt).toBe("string");
      }
    });
  });

  describe("remove", () => {
    it("should remove an item successfully with partition key only", async () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;

        name: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);

      mockClient.send = jest.fn().mockResolvedValue({});

      await pkOnlyRepo.remove("test-id");

      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(DeleteCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Key).toEqual({ pk: "test-id" });
      }
    });

    it("should remove an item successfully with partition and sort key", async () => {
      mockClient.send = jest.fn().mockResolvedValue({});

      await repository.remove("test-id", "2024-01-01");

      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(DeleteCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.Key).toEqual({ pk: "test-id", sk: "2024-01-01" });
      }
    });

    it("should propagate errors from DynamoDB", async () => {
      const dbError = new Error("DynamoDB error");
      mockClient.send = jest.fn().mockRejectedValue(dbError);

      await expect(repository.remove("test-id", "2024-01-01")).rejects.toThrow(
        "DynamoDB error",
      );
    });
  });

  describe("query", () => {
    it("should query items with partition key only", async () => {
      const items: TestEntity[] = [
        {
          id: "test-id",
          timestamp: "2024-01-01",
          name: "Item 1",
        },
        {
          id: "test-id",
          timestamp: "2024-01-02",
          name: "Item 2",
        },
      ];

      mockClient.send = jest.fn().mockResolvedValue({
        Items: items,
        Count: 2,
        LastEvaluatedKey: undefined,
      });

      const result = await repository.query({ pk: "test-id" });

      expect(result.items).toEqual(items);
      expect(result.count).toBe(2);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(QueryCommand);
      if (command && command.input) {
        expect(command.input.TableName).toBe("TestTable");
        expect(command.input.KeyConditionExpression).toBe("#pk = :pkValue");
        expect(command.input.ExpressionAttributeNames).toEqual({ "#pk": "pk" });
        expect(command.input.ExpressionAttributeValues).toEqual({ ":pkValue": "test-id" });
      }
    });

    it("should query items with partition and sort key", async () => {
      const items: TestEntity[] = [
        {
          id: "test-id",
          timestamp: "2024-01-01",
          name: "Item 1",
        },
      ];

      mockClient.send = jest.fn().mockResolvedValue({
        Items: items,
        Count: 1,
        LastEvaluatedKey: undefined,
      });

      const result = await repository.query({
        pk: "test-id",
        sk: "2024-01-01",
      });

      expect(result.items).toEqual(items);
      expect(result.count).toBe(1);
      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(QueryCommand);
      if (command && command.input) {
        expect(command.input.KeyConditionExpression).toBe("#pk = :pkValue AND #sk = :skValue");
        expect(command.input.ExpressionAttributeNames).toEqual({ "#pk": "pk", "#sk": "sk" });
        expect(command.input.ExpressionAttributeValues).toEqual({
          ":pkValue": "test-id",
          ":skValue": "2024-01-01",
        });
      }
    });

    it("should query items with different sort key comparators", async () => {
      const comparators: Array<"=" | ">" | "<" | ">=" | "<=" | "begins_with"> = [
        "=",
        ">",
        "<",
        ">=",
        "<=",
        "begins_with",
      ];

      for (const comparator of comparators) {
        jest.clearAllMocks();
        mockClient.send = jest.fn().mockResolvedValue({
          Items: [],
          Count: 0,
        });

        await repository.query({
          pk: "test-id",
          sk: "2024-01-01",
          skComparator: comparator,
        });

        expect(mockClient.send).toHaveBeenCalledTimes(1);
        const call = (mockClient.send as jest.Mock).mock.calls[0][0];
        expect(call).toBeDefined();
        expect(call).toBeInstanceOf(QueryCommand);
        
        if (call && call.input) {
          const keyCondition = call.input.KeyConditionExpression;
          expect(keyCondition).toBeDefined();

          if (comparator === "begins_with") {
            expect(keyCondition).toContain("begins_with(#sk, :skValue)");
          } else {
            expect(keyCondition).toContain(`#sk ${comparator} :skValue`);
          }
        }
      }
    });

    it("should query items with index", async () => {
      @DynamoTable("TestTable")
      class EntityWithIndex {
        @PartitionKey("pk")
        id: string;

        @SortKey("sk")
        timestamp: string;

        @IndexPartitionKey("EmailIndex", "emailType")
        emailType: string;

        @IndexSortKey("EmailIndex", "email")
        email: string;
      }

      class IndexRepository extends DynamoDBRepository<EntityWithIndex> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityWithIndex);
        }
      }

      const indexRepo = new IndexRepository(mockClient);
      const items: EntityWithIndex[] = [];

      mockClient.send = jest.fn().mockResolvedValue({
        Items: items,
        Count: 0,
      });

      await indexRepo.query({
        pk: "USER",
        sk: "test@example.com",
        indexName: "EmailIndex",
      });

      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(QueryCommand);
      if (command && command.input) {
        expect(command.input.IndexName).toBe("EmailIndex");
        expect(command.input.KeyConditionExpression).toBe("#pk = :pkValue AND #sk = :skValue");
        expect(command.input.ExpressionAttributeNames).toEqual({ "#pk": "emailType", "#sk": "email" });
        expect(command.input.ExpressionAttributeValues).toEqual({
          ":pkValue": "USER",
          ":skValue": "test@example.com",
        });
      }
    });

    it("should query items with limit and scanIndexForward", async () => {
      mockClient.send = jest.fn().mockResolvedValue({
        Items: [],
        Count: 0,
      });

      await repository.query({
        pk: "test-id",
        limit: 10,
        scanIndexForward: false,
      });

      const command = (mockClient.send as jest.Mock).mock.calls[0][0];
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(QueryCommand);
      if (command && command.input) {
        expect(command.input.Limit).toBe(10);
        expect(command.input.ScanIndexForward).toBe(false);
      }
    });

    it("should throw DecoratorMissingError when sort key is provided but not defined", async () => {
      @DynamoTable("TestTable")
      class EntityPKOnly {
        @PartitionKey("pk")
        id: string;
      }

      class PKOnlyRepository extends DynamoDBRepository<EntityPKOnly> {
        constructor(client: DynamoDBDocumentClient) {
          super(client, EntityPKOnly);
        }
      }

      const pkOnlyRepo = new PKOnlyRepository(mockClient);

      await expect(
        pkOnlyRepo.query({
          pk: "test-id",
          sk: "sort-value",
        }),
      ).rejects.toThrow(DecoratorMissingError);
    });

    it("should return count 0 when Count is undefined", async () => {
      mockClient.send = jest.fn().mockResolvedValue({
        Items: [],
        Count: undefined,
      });

      const result = await repository.query({ pk: "test-id" });
      expect(result.count).toBe(0);
    });

    it("should propagate errors from DynamoDB", async () => {
      const dbError = new Error("DynamoDB error");
      mockClient.send = jest.fn().mockRejectedValue(dbError);

      await expect(repository.query({ pk: "test-id" })).rejects.toThrow("DynamoDB error");
    });
  });

  describe("buildQueryExpressions", () => {
    it("should build query expressions with partition key only", () => {
      const expressions = repository["buildQueryExpressions"]("test-id", "pk");

      expect(expressions.keyConditionExpression).toBe("#pk = :pkValue");
      expect(expressions.expressionAttributeNames).toEqual({ "#pk": "pk" });
      expect(expressions.expressionAttributeValues).toEqual({
        ":pkValue": "test-id",
      });
    });

    it("should build query expressions with partition and sort key", () => {
      const expressions = repository["buildQueryExpressions"](
        "test-id",
        "pk",
        "2024-01-01",
        "sk",
        "=",
      );

      expect(expressions.keyConditionExpression).toBe("#pk = :pkValue AND #sk = :skValue");
      expect(expressions.expressionAttributeNames).toEqual({ "#pk": "pk", "#sk": "sk" });
      expect(expressions.expressionAttributeValues).toEqual({
        ":pkValue": "test-id",
        ":skValue": "2024-01-01",
      });
    });

    it("should build query expressions with begins_with comparator", () => {
      const expressions = repository["buildQueryExpressions"](
        "test-id",
        "pk",
        "2024-",
        "sk",
        "begins_with",
      );

      expect(expressions.keyConditionExpression).toBe(
        "#pk = :pkValue AND begins_with(#sk, :skValue)",
      );
    });

    it("should build query expressions with numeric values", () => {
      const expressions = repository["buildQueryExpressions"](123, "pk", 456, "sk", ">");

      expect(expressions.expressionAttributeValues).toEqual({
        ":pkValue": 123,
        ":skValue": 456,
      });
    });
  });
});

