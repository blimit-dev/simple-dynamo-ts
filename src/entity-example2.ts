import {
  CompositePartitionKey,
  CompositeSortKey,
  DynamoTable,
} from "./decorators";

@DynamoTable("User")
export class UserEntity {
  @CompositePartitionKey("pk")
  orgId!: string;
  @CompositePartitionKey("pk")
  id: string = "generate-id";
  @CompositeSortKey("sk")
  role: string = "USER";
  @CompositeSortKey("sk")
  email!: string;
  password!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string | undefined;
}
