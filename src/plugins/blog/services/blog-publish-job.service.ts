import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ID, JobQueue, JobQueueService, ProcessContext, RequestContextService } from '@vendure/core';

import { BlogService } from './blog.service';

const LOG_CTX = 'BlogPublishJob';
/** Check for overdue scheduled posts every 15 minutes */
const POLL_INTERVAL_MS = 15 * 60 * 1000;

@Injectable()
export class BlogPublishJobService implements OnModuleInit {
    private queue: JobQueue<{ blogPostId: ID }>;
    private readonly logger = new Logger(LOG_CTX);

    constructor(
        private jobQueueService: JobQueueService,
        private processContext: ProcessContext,
        private requestContextService: RequestContextService,
        private blogService: BlogService,
    ) {}

    async onModuleInit() {
        this.queue = await this.jobQueueService.createQueue({
            name: 'publish-blog-post',
            process: async (_job) => {
                const ctx = await this.requestContextService.create({ apiType: 'admin' });
                await this.blogService.publishScheduledPosts(ctx);
                this.logger.log('Processed scheduled blog posts');
            },
        });

        // Only run the periodic publisher on the server process (not the worker).
        if (this.processContext.isServer) {
            this.startPeriodicPublisher();
        }

        this.logger.log('Created publish-blog-post job queue');
    }

    /**
     * Starts a periodic poll that enqueues a publish job every `POLL_INTERVAL_MS`.
     * This replaces the old in-memory `setTimeout` approach which was not
     * restart-safe and whose `schedulePublish` call was never wired up.
     */
    private startPeriodicPublisher() {
        // Run once shortly after startup (30s delay) to catch any posts that
        // were scheduled while the server was down.
        setTimeout(() => this.enqueuePublishCheck(), 30_000);

        // Then run every POLL_INTERVAL_MS thereafter.
        setInterval(() => this.enqueuePublishCheck(), POLL_INTERVAL_MS);
    }

    private async enqueuePublishCheck() {
        try {
            await this.queue.add({ blogPostId: 0 as ID }, { retries: 3 });
            this.logger.log('Enqueued scheduled-post publish check');
        } catch (e: any) {
            this.logger.error(`Failed to enqueue publish check: ${e.message}`);
        }
    }
}
