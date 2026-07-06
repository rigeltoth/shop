import { graphql } from '@/gql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getBlogPostDetail = graphql(`
    query GetBlogPostDetail($id: ID!) {
        blogPost(id: $id) {
            id
            createdAt
            updatedAt
            slug
            status
            publishedAt
            scheduledAt
            archivedAt
            canonicalUrl
            structuredData
            readingTimeMinutes
            featuredImage {
                id
                preview
            }
            ogImage {
                id
                preview
            }
            author {
                id
                firstName
                lastName
                emailAddress
            }
            categories {
                id
                name
            }
            tags {
                id
                name
            }
            relatedProducts {
                id
                name
                slug
            }
            relatedPosts {
                id
                slug
                title
            }
            title
            content
            excerpt
            metaTitle
            metaDescription
        }
    }
`);

const updateBlogPost = graphql(`
    mutation UpdateBlogPost($input: UpdateBlogPostInput!) {
        updateBlogPost(input: $input) {
            id
        }
    }
`);

const createBlogPost = graphql(`
    mutation CreateBlogPost($input: CreateBlogPostInput!) {
        createBlogPost(input: $input) {
            id
        }
    }
`);

export const blogDetail: DashboardRouteDefinition = {
    path: '/blog/$id',
    loader: detailPageRouteLoader({
        queryDocument: getBlogPostDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/blog', label: 'Blog' },
            isNew ? (entity ? 'New Post' : 'New Post') : (entity as any)?.title ?? 'Post',
        ],
    }),
    component: route => {
        const DetailPageComponent = DetailPage as any;
        return (
            <DetailPageComponent
                pageId="blog-detail"
                route={route}
                title={(post: any) => post?.title ?? 'Blog Post'}
                queryDocument={getBlogPostDetail}
                createDocument={createBlogPost}
                updateDocument={updateBlogPost}
                setValuesForUpdate={(post: any) => ({
                    id: post?.id,
                    title: post?.title,
                    content: post?.content,
                    slug: post?.slug,
                    excerpt: post?.excerpt,
                    languageCode: post?.languageCode,
                    status: post?.status,
                    scheduledAt: post?.scheduledAt,
                    featuredImageId: post?.featuredImage?.id,
                    ogImageId: post?.ogImage?.id,
                    authorId: post?.author?.id,
                    categoryIds: post?.categories?.map((c: any) => c.id),
                    tagIds: post?.tags?.map((t: any) => t.id),
                    relatedProductIds: post?.relatedProducts?.map((p: any) => p.id),
                    relatedPostIds: post?.relatedPosts?.map((p: any) => p.id),
                    metaTitle: post?.metaTitle,
                    metaDescription: post?.metaDescription,
                    canonicalUrl: post?.canonicalUrl,
                    structuredData: post?.structuredData,
                })}
            />
        );
    },
};
