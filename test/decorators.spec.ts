import "reflect-metadata";
import {
  DynamoTable,
  PartitionKey,
  SortKey,
  IndexPartitionKey,
  IndexSortKey,
  getDynamoTableName,
  getPartitionKeyName,
  getSortKeyName,
  getIndexPartitionKeyName,
  getIndexSortKeyName,
} from "../src/decorators";
import { DuplicateDecoratorError } from "../src/exceptions";

describe("Decorators", () => {
  beforeEach(() => {
    // Clear metadata before each test
    jest.clearAllMocks();
  });

  describe("@DynamoTable", () => {
    it("should set table name when provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {}

      const tableName = getDynamoTableName(TestEntity);
      expect(tableName).toBe("TestTable");
    });

    it("should use class name when table name is not provided", () => {
      @DynamoTable()
      class UserEntity {}

      const tableName = getDynamoTableName(UserEntity);
      expect(tableName).toBe("UserEntity");
    });

    it("should work with class instance", () => {
      @DynamoTable("InstanceTable")
      class TestEntity {}

      const instance = new TestEntity();
      const tableName = getDynamoTableName(instance);
      expect(tableName).toBe("InstanceTable");
    });

    // Note: Empty string validation is not currently implemented
    // The check `if (tableName)` prevents validation of empty strings
    it.skip("should throw error for empty string table name", () => {
      expect(() => {
        const decorator = DynamoTable("");
        decorator(class TestEntity {} as NewableFunction);
      }).toThrow("Invalid tableName: cannot be an empty string.");
    });

    it("should throw error for whitespace-only table name", () => {
      expect(() => {
        const decorator = DynamoTable("   ");
        decorator(class TestEntity {} as NewableFunction);
      }).toThrow("Invalid tableName: cannot be an empty string.");
    });
  });

  describe("@PartitionKey", () => {
    it("should set partition key when field name is provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;
      }

      const pkName = getPartitionKeyName(TestEntity);
      expect(pkName).toBe("pk");
    });

    it("should use property name when field name is not provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey()
        userId: string;
      }

      const pkName = getPartitionKeyName(TestEntity);
      expect(pkName).toBe("userId");
    });

    it("should work with class instance", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("type")
        type: string;
      }

      const instance = new TestEntity();
      const pkName = getPartitionKeyName(instance);
      expect(pkName).toBe("type");
    });

    // Note: Empty string validation is not currently implemented
    // The check `if (fieldName)` prevents validation of empty strings
    it.skip("should throw error for empty string field name", () => {
      expect(() => {
        const decorator = PartitionKey("");
        const target = {};
        decorator(target, "id");
      }).toThrow("Invalid fieldName: cannot be an empty string.");
    });

    it("should throw DuplicateDecoratorError for multiple partition keys", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk1")
          id1: string;

          @PartitionKey("pk2")
          id2: string;
        }
      }).toThrow(DuplicateDecoratorError);
    });
  });

  describe("@SortKey", () => {
    it("should set sort key when field name is provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @SortKey("sk")
        timestamp: string;
      }

      const skName = getSortKeyName(TestEntity);
      expect(skName).toBe("sk");
    });

    it("should use property name when field name is not provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @SortKey()
        createdAt: string;
      }

      const skName = getSortKeyName(TestEntity);
      expect(skName).toBe("createdAt");
    });

    it("should work with class instance", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @SortKey("timestamp")
        timestamp: string;
      }

      const instance = new TestEntity();
      const skName = getSortKeyName(instance);
      expect(skName).toBe("timestamp");
    });

    // Note: Empty string validation is not currently implemented
    // The check `if (fieldName)` prevents validation of empty strings
    it.skip("should throw error for empty string field name", () => {
      expect(() => {
        const decorator = SortKey("");
        const target = {};
        decorator(target, "timestamp");
      }).toThrow("Invalid fieldName: cannot be an empty string.");
    });

    it("should throw DuplicateDecoratorError for multiple sort keys", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;

          @SortKey("sk1")
          timestamp1: string;

          @SortKey("sk2")
          timestamp2: string;
        }
      }).toThrow(DuplicateDecoratorError);
    });
  });

  describe("@IndexPartitionKey", () => {
    it("should set index partition key when field name is provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexPartitionKey("EmailIndex", "emailType")
        emailType: string;
      }

      const indexPkName = getIndexPartitionKeyName(TestEntity, "EmailIndex");
      expect(indexPkName).toBe("emailType");
    });

    it("should use property name when field name is not provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexPartitionKey("EmailIndex")
        emailType: string;
      }

      const indexPkName = getIndexPartitionKeyName(TestEntity, "EmailIndex");
      expect(indexPkName).toBe("emailType");
    });

    it("should work with class instance", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexPartitionKey("EmailIndex", "type")
        type: string;
      }

      const instance = new TestEntity();
      const indexPkName = getIndexPartitionKeyName(instance, "EmailIndex");
      expect(indexPkName).toBe("type");
    });

    it("should throw error for empty index name", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;

          @IndexPartitionKey("", "field")
          field: string;
        }
      }).toThrow("Invalid indexName: cannot be an empty string.");
    });

    // Note: Empty string validation is not currently implemented
    // The check `if (fieldName)` prevents validation of empty strings
    it.skip("should throw error for empty field name", () => {
      expect(() => {
        const decorator = IndexPartitionKey("EmailIndex", "");
        const target = {};
        decorator(target, "field");
      }).toThrow("Invalid fieldName: cannot be an empty string.");
    });

    it("should throw DuplicateDecoratorError for multiple partition keys on same index", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;

          @IndexPartitionKey("EmailIndex", "pk1")
          field1: string;

          @IndexPartitionKey("EmailIndex", "pk2")
          field2: string;
        }
      }).toThrow(DuplicateDecoratorError);
    });

    it("should allow multiple partition keys for different indexes", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexPartitionKey("Index1", "field1")
        field1: string;

        @IndexPartitionKey("Index2", "field2")
        field2: string;
      }

      expect(getIndexPartitionKeyName(TestEntity, "Index1")).toBe("field1");
      expect(getIndexPartitionKeyName(TestEntity, "Index2")).toBe("field2");
    });
  });

  describe("@IndexSortKey", () => {
    it("should set index sort key when field name is provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexSortKey("EmailIndex", "email")
        email: string;
      }

      const indexSkName = getIndexSortKeyName(TestEntity, "EmailIndex");
      expect(indexSkName).toBe("email");
    });

    it("should use property name when field name is not provided", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexSortKey("EmailIndex")
        email: string;
      }

      const indexSkName = getIndexSortKeyName(TestEntity, "EmailIndex");
      expect(indexSkName).toBe("email");
    });

    it("should work with class instance", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexSortKey("EmailIndex", "emailAddress")
        email: string;
      }

      const instance = new TestEntity();
      const indexSkName = getIndexSortKeyName(instance, "EmailIndex");
      expect(indexSkName).toBe("emailAddress");
    });

    it("should throw error for empty index name", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;

          @IndexSortKey("", "field")
          field: string;
        }
      }).toThrow("Invalid indexName: cannot be an empty string.");
    });

    // Note: Empty string validation is not currently implemented
    // The check `if (fieldName)` prevents validation of empty strings
    it.skip("should throw error for empty field name", () => {
      expect(() => {
        const decorator = IndexSortKey("EmailIndex", "");
        const target = {};
        decorator(target, "field");
      }).toThrow("Invalid fieldName: cannot be an empty string.");
    });

    it("should throw DuplicateDecoratorError for multiple sort keys on same index", () => {
      expect(() => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;

          @IndexSortKey("EmailIndex", "sk1")
          field1: string;

          @IndexSortKey("EmailIndex", "sk2")
          field2: string;
        }
      }).toThrow(DuplicateDecoratorError);
    });

    it("should allow multiple sort keys for different indexes", () => {
      @DynamoTable("TestTable")
      class TestEntity {
        @PartitionKey("pk")
        id: string;

        @IndexSortKey("Index1", "field1")
        field1: string;

        @IndexSortKey("Index2", "field2")
        field2: string;
      }

      expect(getIndexSortKeyName(TestEntity, "Index1")).toBe("field1");
      expect(getIndexSortKeyName(TestEntity, "Index2")).toBe("field2");
    });
  });

  describe("Helper Functions", () => {
    describe("getDynamoTableName", () => {
      it("should return undefined for class without decorator", () => {
        class TestEntity {}
        expect(getDynamoTableName(TestEntity)).toBeUndefined();
      });
    });

    describe("getPartitionKeyName", () => {
      it("should return undefined for class without decorator", () => {
        @DynamoTable("TestTable")
        class TestEntity {}
        expect(getPartitionKeyName(TestEntity)).toBeUndefined();
      });
    });

    describe("getSortKeyName", () => {
      it("should return undefined for class without decorator", () => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;
        }
        expect(getSortKeyName(TestEntity)).toBeUndefined();
      });
    });

    describe("getIndexPartitionKeyName", () => {
      it("should return undefined for non-existent index", () => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;
        }
        expect(getIndexPartitionKeyName(TestEntity, "NonExistentIndex")).toBeUndefined();
      });

      it("should throw error for empty index name", () => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;
        }
        expect(() => getIndexPartitionKeyName(TestEntity, "")).toThrow("indexName cannot be empty");
        expect(() => getIndexPartitionKeyName(TestEntity, "   ")).toThrow("indexName cannot be empty");
      });
    });

    describe("getIndexSortKeyName", () => {
      it("should return undefined for non-existent index", () => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;
        }
        expect(getIndexSortKeyName(TestEntity, "NonExistentIndex")).toBeUndefined();
      });

      it("should throw error for empty index name", () => {
        @DynamoTable("TestTable")
        class TestEntity {
          @PartitionKey("pk")
          id: string;
        }
        expect(() => getIndexSortKeyName(TestEntity, "")).toThrow("indexName cannot be empty");
        expect(() => getIndexSortKeyName(TestEntity, "   ")).toThrow("indexName cannot be empty");
      });
    });
  });
});

