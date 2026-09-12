import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { UseGuards } from '@nestjs/common';
import { FeatureAccessGuard } from '../../wompi-subscription/guards';
import { RequiresFeature } from '../../wompi-subscription/decorators/requires-feature.decorator';
import { FEATURE_CODES } from '../../wompi-subscription/constants';
import { AiChat } from '../services/ai-chat';

@Resolver()
export class AiChatAdminResolver {
    constructor(private aiChat: AiChat) {}

    @Mutation()
    @Allow(Permission.Public)
    @UseGuards(FeatureAccessGuard)
    @RequiresFeature(FEATURE_CODES.AI_ACCESS)
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
