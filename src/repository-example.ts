import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UserEntity } from "./entity-example";
import { QueryOptions } from "./types";
import { DynamoDBRepository } from "./simple-dynamodb-repository";

export class UsersRepository extends DynamoDBRepository<UserEntity> {
  constructor(protected readonly client: DynamoDBDocumentClient) {
    super(client, UserEntity);
  }

  //TODO pagination
  async findAll(): Promise<UserEntity[]> {
    const response = await this.query({ pk: "USER" });
    return response.items;
  }

  async getById(id: string) {
    return await this.getItem("USER", id);
  }

  async delete(id: string) {
    return await this.softDelete("USER", id);
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const queryOptions: QueryOptions = {
      pk: "USER",
      sk: email,
      indexName: "EmailIndex",
    };
    const response = await this.query(queryOptions);

    //Its not possible to have more than one user with the same email since it is a key in the database,
    //so only validating if count is different than 0
    if (response.count) return response.items[0];

    throw new Error("User with this email not found!");
  }
}
