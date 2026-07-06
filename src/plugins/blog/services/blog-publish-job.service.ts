import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ID, JobQueue, JobQueueService, ProcessContext, RequestContext } from '@vendure/core';

import { BlogService } from './blog.service';

const LOG_CTX = 'BlogPublishJob';

@Injectable()
export class BlogPublishJobService implements OnModuleInit {
    private queue: JobQueue<{ blogPostId: ID }>;
    private readonly logger = new Logger(LOG_CTX);

    constructor(
        private jobQueueService: JobQueueService,
        private processContext: ProcessContext,
        private blogService: BlogService,
    ) {}

    async onModuleInit() {
        this.queue = await this.jobQueueService.createQueue({
            name: 'publish-blog-post',
            process: async (job) => {
                await this.blogService.publishScheduledPosts(new RequestContext({} as any));
                this.logger.log(`Published scheduled blog post ${job.data.blogPostId}`);
            },
        });
        this.logger.log('Created publish-blog-post job queue');
    }

    async schedulePublish(blogPostId: ID, scheduledAt: Date): Promise<void> {
        const delay = scheduledAt.getTime() - Date.now();
        if (delay > 0) {
            setTimeout(async () => {
                await this.queue.add({ blogPostId }, { retries: 3 });
                this.logger.log(`Enqueued publish job for blog post ${blogPostId}`);
            }, delay);
        } else {
            await this.queue.add({ blogPostId }, { retries: 3 });
        }
    }
}
