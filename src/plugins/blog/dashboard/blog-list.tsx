import { graphql } from '@/gql';
import { Button, DashboardRouteDefinition, DetailPageButton, ListPage, PageActionBarRight } from '@vendure/dashboard';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';

const getBlogPostList = graphql(`
    query GetBlogPosts($options: BlogPostListOptions) {
        blogPosts(options: $options) {
            items {
                id
                createdAt
                updatedAt
                slug
                status
                publishedAt
                scheduledAt
                readingTimeMinutes
                featuredImage {
                    id
                    preview
                }
                author {
                    id
                    firstName
                    lastName
                }
                title
                excerpt
                categories {
                    id
                    name
                }
                tags {
                    id
                    name
                }
            }
            totalItems
        }
    }
`);

const deleteBlogPost = graphql(`
    mutation DeleteBlogPost($id: ID!) {
        deleteBlogPost(id: $id)
    }
`);

export const blogList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'catalog',
        id: 'blog',
        url: '/blog',
        title: 'Blog',
        requiresPermission: ['ReadCatalog'],
    },
    path: '/blog',
    loader: () => ({
        breadcrumb: 'Blog',
    }),
    component: route => {
        const ListPageComponent = ListPage as any;
        return (
            <ListPageComponent
                pageId="blog-list"
                title="Blog Posts"
                listQuery={getBlogPostList}
                deleteMutation={deleteBlogPost}
                route={route}
                defaultVisibility={{
                    featuredImage: false,
                    author: false,
                    excerpt: false,
                    categories: false,
                    tags: false,
                    scheduledAt: false,
                    readingTimeMinutes: false,
                }}
                customizeColumns={{
                    id: {
                        header: 'ID',
                        cell: ({ row }: any) => {
                            return <span>{row.original.id}</span>;
                        },
                    },
                    title: {
                        header: 'Title',
                        cell: ({ row }: any) => {
                            return <DetailPageButton id={row.original.id} label={row.original.title} />;
                        },
                    },
                    status: {
                        header: 'Status',
                        cell: ({ row }: any) => {
                            const status = row.original.status;
                            const colors: Record<string, string> = {
                                draft: 'text-yellow-600 bg-yellow-50',
                                published: 'text-green-600 bg-green-50',
                                archived: 'text-gray-600 bg-gray-50',
                            };
                            return (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || ''}`}>
                                    {status}
                                </span>
                            );
                        },
                    },
                    publishedAt: {
                        header: 'Published',
                        cell: ({ row }: any) => {
                            return row.original.publishedAt
                                ? new Date(row.original.publishedAt).toLocaleDateString()
                                : '-';
                        },
                    },
                }}
            >
                <PageActionBarRight>
                    <Button render={<Link to="./new" />}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Post
                    </Button>
                </PageActionBarRight>
            </ListPageComponent>
        );
    },
};
