import gql from 'graphql-tag';

export const bifrostApiExtensions = gql`
  type BifrostKey {
    id: ID!
    value: String!
    administratorId: Int
    kind: String!
    planName: String!
    isActive: Boolean!
    expiresAt: DateTime
    createdAt: DateTime!
  }

  type BifrostUsage {
    budgetMax: Float!
    budgetUsed: Float!
    budgetResetAt: DateTime
    tokenUsed: Int!
    tokenLimit: Int!
    requestUsed: Int!
    requestLimit: Int!
    isActive: Boolean!
    usagePercent: Float!
  }

  type BifrostKeyUsage {
    key: BifrostKey!
    usage: BifrostUsage!
  }

  extend type Query {
    myBifrostKey: BifrostKey
    myBifrostKeyUsage: BifrostKeyUsage
    bifrostKeys: [BifrostKey!]!
    bifrostKeyUsages: [BifrostKeyUsage!]!
  }

  extend type Mutation {
    provisionBifrostKey(administratorId: ID!): BifrostKey
  }
`;
