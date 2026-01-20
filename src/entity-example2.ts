import { CompositePartitionKey, DynamoTable, IndexSortKey } from "./decorators";

@DynamoTable("User")
export class UserEntity {
  @CompositePartitionKey("pk")
  orgId!: string;
  @CompositePartitionKey("pk")
  id: string = "generate-id";
  @IndexSortKey("EmailIndex")
  email!: string;
  password!: string;
  role: string = "USER";
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string | undefined;
}
