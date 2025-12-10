import { DynamoTable, IndexSortKey, PartitionKey, SortKey } from "./decorators";

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
  deletedAt?: string | undefined;
}
