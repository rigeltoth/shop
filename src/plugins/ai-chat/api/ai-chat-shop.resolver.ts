import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { AiChat } from '../services/ai-chat';

@Resolver()
export class AiChatShopResolver {
    constructor(private aiChat: AiChat) {}

    @Mutation()
    @Allow(Permission.Public)
    async sendChatMessage(
        @Ctx() ctx: RequestContext, 
        @Args() args: { 
            message: string; 
            history: Array<{role: string, content: string}> 
        }
    ): Promise<{response: string, error?: string}> {
        try {
            const result = await this.aiChat.sendMessage(ctx, args.message, args.history);
            return { response: result.response };
        } catch (error) {
            return { 
                response: '', 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }
}