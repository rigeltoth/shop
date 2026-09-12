import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    type BlogAuthor {
        id: ID!
        firstName: String!
        lastName: String!
        emailAddress: String
    }

    type BlogPost implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        slug: String!
        status: String!
        publishedAt: DateTime
        scheduledAt: DateTime
        archivedAt: DateTime
        canonicalUrl: String
        structuredData: String
        readingTimeMinutes: Int!
        featuredImage: Asset
        ogImage: Asset
        author: BlogAuthor
        categories: [BlogCategory!]!
        tags: [BlogTag!]!
        relatedProducts: [Product!]!
        relatedPosts: [BlogPost!]!
        title: String!
        content: String!
        excerpt: String
        metaTitle: String
        metaDescription: String
    }

    type BlogPostList implements PaginatedList {
        items: [BlogPost!]!
        totalItems: Int!
    }

    type BlogCategory implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        slug: String!
        name: String!
        description: String
        posts: [BlogPost!]!
        metaTitle: String
        metaDescription: String
    }

    type BlogTag implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        slug: String!
    }

    input BlogPostListOptions
`;

export const adminApiExtensions = gql`
    ${commonApiExtensions}

    input CreateBlogPostInput {
        slug: String
        title: String!
        content: String!
        excerpt: String
        languageCode: LanguageCode!
        status: String
        scheduledAt: DateTime
        featuredImageId: ID
        ogImageId: ID
        authorId: ID
        categoryIds: [ID!]
        tagIds: [ID!]
        relatedProductIds: [ID!]
        relatedPostIds: [ID!]
        metaTitle: String
        metaDescription: String
        canonicalUrl: String
        structuredData: String
    }

    input UpdateBlogPostInput {
        id: ID!
        slug: String
        title: String
        content: String
        excerpt: String
        languageCode: LanguageCode
        status: String
        scheduledAt: DateTime
        featuredImageId: ID
        ogImageId: ID
        authorId: ID
        categoryIds: [ID!]
        tagIds: [ID!]
        relatedProductIds: [ID!]
        relatedPostIds: [ID!]
        metaTitle: String
        metaDescription: String
        canonicalUrl: String
        structuredData: String
    }

    input CreateBlogCategoryInput {
        slug: String
        name: String!
        description: String
        languageCode: LanguageCode!
        metaTitle: String
        metaDescription: String
    }

    input UpdateBlogCategoryInput {
        id: ID!
        slug: String
        name: String
        description: String
        languageCode: LanguageCode
        metaTitle: String
        metaDescription: String
    }

    input CreateBlogTagInput {
        name: String!
        slug: String
    }

    extend type Query {
        blogPost(id: ID!): BlogPost
        blogPosts(options: BlogPostListOptions): BlogPostList!
        blogCategories: [BlogCategory!]!
        blogTags: [BlogTag!]!
    }

    extend type Mutation {
        createBlogPost(input: CreateBlogPostInput!): BlogPost!
        updateBlogPost(input: UpdateBlogPostInput!): BlogPost!
        deleteBlogPost(id: ID!): Boolean!
        publishBlogPost(id: ID!): BlogPost!
        unpublishBlogPost(id: ID!): BlogPost!
        archiveBlogPost(id: ID!): BlogPost!
        createBlogCategory(input: CreateBlogCategoryInput!): BlogCategory!
        updateBlogCategory(input: UpdateBlogCategoryInput!): BlogCategory!
        deleteBlogCategory(id: ID!): Boolean!
        createBlogTag(input: CreateBlogTagInput!): BlogTag!
        deleteBlogTag(id: ID!): Boolean!
    }
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}

    extend type Query {
        blogPost(slug: String!, languageCode: LanguageCode): BlogPost
        blogPosts(options: BlogPostListOptions, languageCode: LanguageCode): BlogPostList!
        blogPostsByCategory(categorySlug: String!, options: BlogPostListOptions): BlogPostList!
        blogPostsByTag(tagSlug: String!, options: BlogPostListOptions): BlogPostList!
        blogCategories(languageCode: LanguageCode): [BlogCategory!]!
        blogTags: [BlogTag!]!
    }
`;
