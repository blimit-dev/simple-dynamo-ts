# simple-dynamo-ts

A simple, type-safe TypeScript library for working with AWS DynamoDB using decorators and a repository pattern. This library provides a clean and intuitive API for DynamoDB operations while maintaining type safety and leveraging TypeScript decorators for entity configuration.

## Features

- 🎯 **Type-Safe**: Full TypeScript support with type inference
- 🏗️ **Decorator-Based**: Use decorators to define DynamoDB entities and keys
- 📦 **Repository Pattern**: Extend `DynamoDBRepository` for clean, reusable data access
- 🔍 **Query Support**: Built-in support for queries, indexes, and sort key comparisons
- 🛡️ **Error Handling**: Custom error classes for better error handling
- ⚡ **Lightweight**: Minimal dependencies, only requires `@aws-sdk/lib-dynamodb` and `reflect-metadata`

## Installation

```bash
npm install simple-dynamo-ts
# or
pnpm add simple-dynamo-ts
# or
yarn add simple-dynamo-ts
```

### Peer Dependencies

This library requires `@aws-sdk/lib-dynamodb` as a peer dependency:

```bash
npm install @aws-sdk/lib-dynamodb
```

## Prerequisites

- TypeScript 5.7+
- Node.js 18+
- Enable `experimentalDecorators` and `emitDecoratorMetadata` in your `tsconfig.json`

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start

### 1. Define Your Entity

Create a class representing your DynamoDB table item and decorate it:

```typescript
import { DynamoTable, PartitionKey, SortKey, IndexSortKey } from "simple-dynamo-ts";

@DynamoTable("User")
export class UserEntity {
  @PartitionKey()
  orgId!: string;

  @SortKey()
  id: string = "generate-id";

  @IndexSortKey("EmailIndex")
  email!: string;

  password!: string;
  role: string = "USER";
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string;
}
```

### 2. Create a Repository

Extend `DynamoDBRepository` to create your repository:

```typescript
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRepository, QueryOptions } from "simple-dynamo-ts";
import { UserEntity } from "./user.entity";

export class UsersRepository extends DynamoDBRepository<UserEntity> {
  constructor(protected readonly client: DynamoDBDocumentClient) {
    super(client, UserEntity);
  }

  async findAll(): Promise<UserEntity[]> {
    const response = await this.query({ pk: "USER" });
    return response.items;
  }

  async getById(id: string): Promise<UserEntity> {
    return await this.getItem("USER", id);
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const queryOptions: QueryOptions = {
      pk: "USER",
      sk: email,
      indexName: "EmailIndex",
    };
    const response = await this.query(queryOptions);

    if (response.count) return response.items[0];
    throw new Error("User with this email not found!");
  }
}
```

### 3. Use Your Repository

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UsersRepository } from "./users.repository";

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Create repository instance
const usersRepository = new UsersRepository(docClient);

// Use repository methods
const user = await usersRepository.getById("user-123");
const allUsers = await usersRepository.findAll();
const userByEmail = await usersRepository.findByEmail("user@example.com");
```

## Decorators

### `@DynamoTable(tableName?)`

Marks a class as a DynamoDB table entity. The table name is optional - if not provided, the class name will be used.

```typescript
@DynamoTable("User")  // Explicit table name
export class UserEntity { }

@DynamoTable()  // Uses class name "UserEntity" as table name
export class UserEntity { }
```

### `@PartitionKey(fieldName?)`

Marks a property as the partition key (HASH key). The field name is optional - if not provided, the property name will be used.

```typescript
@PartitionKey()  // Uses property name "orgId"
orgId!: string;

@PartitionKey("organizationId")  // Uses "organizationId" as DynamoDB field name
orgId!: string;
```

### `@SortKey(fieldName?)`

Marks a property as the sort key (RANGE key). The field name is optional.

```typescript
@SortKey()
id!: string;
```

### `@IndexPartitionKey(indexName, fieldName?)`

Marks a property as a partition key for a DynamoDB Global Secondary Index (GSI).

```typescript
@IndexPartitionKey("EmailIndex", "orgId")
orgId!: string;
```

### `@IndexSortKey(indexName, fieldName?)`

Marks a property as a sort key for a DynamoDB Global Secondary Index (GSI).

```typescript
@IndexSortKey("EmailIndex", "email")
email!: string;
```

## Repository API

The `DynamoDBRepository<T>` class provides the following methods:

### `create(item: T): Promise<T>`

Creates a new item in DynamoDB. Throws an error if an item with the same key already exists.

```typescript
const newUser: UserEntity = {
  orgId: "ORG-123",
  id: "user-456",
  email: "user@example.com",
  password: "hashed-password",
  role: "USER",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const created = await usersRepository.create(newUser);
```

### `getItem(pk: DynamoKey, sk?: DynamoKey): Promise<T>`

Retrieves a single item by its partition key and optional sort key. Throws `ItemNotFoundError` if the item doesn't exist.

```typescript
// With partition key only
const item = await repository.getItem("PK-VALUE");

// With partition and sort key
const item = await repository.getItem("PK-VALUE", "SK-VALUE");
```

### `put(item: T): Promise<T>`

Puts an item into DynamoDB (creates or updates). Unlike `create`, this will overwrite existing items.

```typescript
const updated = await usersRepository.put(userEntity);
```

### `query(options: QueryOptions): Promise<{ items: T[]; lastEvaluatedKey: T; count: number }>`

Queries DynamoDB items. Supports partition key queries, sort key comparisons, and index queries.

```typescript
// Simple partition key query
const result = await repository.query({ pk: "USER" });

// Query with sort key
const result = await repository.query({
  pk: "USER",
  sk: "user-123",
});

// Query with sort key comparison
const result = await repository.query({
  pk: "USER",
  sk: "user-",
  skComparator: "begins_with",
});

// Query using an index
const result = await repository.query({
  pk: "ORG-123",
  sk: "user@example.com",
  indexName: "EmailIndex",
});

// Query with limit and sort order
const result = await repository.query({
  pk: "USER",
  limit: 10,
  scanIndexForward: false, // Sort descending
});
```

#### QueryOptions

```typescript
type QueryOptions = {
  pk: DynamoKey;                    // Partition key value (required)
  sk?: DynamoKey;                   // Sort key value (optional)
  skComparator?: "=" | ">" | "<" | ">=" | "<=" | "BETWEEN" | "begins_with";
  indexName?: string;               // Index name for GSI or LSI queries
  scanIndexForward?: boolean;        // Sort order (default: true)
  limit?: number;                   // Maximum number of items to return
};
```

### `softDelete(pk: DynamoKey, sk?: DynamoKey): Promise<void>`

Performs a soft delete by setting the `deletedAt` field to the current timestamp.

```typescript
await usersRepository.softDelete("USER", "user-123");
```

### `remove(pk: DynamoKey, sk?: DynamoKey): Promise<void>`

Permanently deletes an item from DynamoDB.

```typescript
await usersRepository.remove("USER", "user-123");
```

## Error Handling

The library provides custom error classes for better error handling:

### `ItemNotFoundError`

Thrown when attempting to get an item that doesn't exist.

```typescript
import { ItemNotFoundError } from "simple-dynamo-ts";

try {
  const user = await repository.getItem("PK", "SK");
} catch (error) {
  if (error instanceof ItemNotFoundError) {
    console.log("Item not found");
  }
}
```

### `InvalidParametersError`

Thrown when invalid parameters are passed to repository methods.

### `DecoratorMissingError`

Thrown when required decorators are missing from entity classes.

### `DuplicateDecoratorError`

Thrown when duplicate decorators are applied (e.g., multiple `@PartitionKey` decorators).

## Complete Example

Here's a complete example demonstrating entity definition and repository usage:

```typescript
// user.entity.ts
import { DynamoTable, PartitionKey, SortKey, IndexSortKey } from "simple-dynamo-ts";

@DynamoTable("User")
export class UserEntity {
  @PartitionKey()
  orgId!: string;

  @SortKey()
  id: string = "generate-id";

  @IndexSortKey("EmailIndex")
  email!: string;

  password!: string;
  role: string = "USER";
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string;
}

// users.repository.ts
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRepository, QueryOptions } from "simple-dynamo-ts";
import { UserEntity } from "./user.entity";

export class UsersRepository extends DynamoDBRepository<UserEntity> {
  constructor(protected readonly client: DynamoDBDocumentClient) {
    super(client, UserEntity);
  }

  async findAll(): Promise<UserEntity[]> {
    const response = await this.query({ pk: "USER" });
    return response.items;
  }

  async getById(id: string): Promise<UserEntity> {
    return await this.getItem("USER", id);
  }

  async delete(id: string): Promise<void> {
    return await this.softDelete("USER", id);
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const queryOptions: QueryOptions = {
      pk: "USER",
      sk: email,
      indexName: "EmailIndex",
    };
    const response = await this.query(queryOptions);

    if (response.count) return response.items[0];
    throw new Error("User with this email not found!");
  }
}

// app.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UsersRepository } from "./users.repository";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);
const usersRepository = new UsersRepository(docClient);

// Create a user
const newUser: UserEntity = {
  orgId: "ORG-123",
  id: "user-456",
  email: "user@example.com",
  password: "hashed-password",
  role: "USER",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
await usersRepository.create(newUser);

// Get user by ID
const user = await usersRepository.getById("user-456");

// Find user by email
const userByEmail = await usersRepository.findByEmail("user@example.com");

// Get all users
const allUsers = await usersRepository.findAll();

// Soft delete
await usersRepository.delete("user-456");
```

## Type Definitions

### `DynamoKey`

```typescript
type DynamoKey = string | number;
```

### `DynamoKeyMap`

```typescript
type DynamoKeyMap = Record<string, DynamoKey>;
```

### `QueryOptions`

See the [Query API](#queryoptions) section above.

## Helper Functions

The library also exports helper functions for retrieving metadata from decorated classes:

- `getDynamoTableName(target)`: Get the table name from a decorated class
- `getPartitionKeyName(target)`: Get the partition key field name
- `getSortKeyName(target)`: Get the sort key field name
- `getIndexPartitionKeyName(target, indexName)`: Get the partition key for an index
- `getIndexSortKeyName(target, indexName)`: Get the sort key for an index

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Blimit
