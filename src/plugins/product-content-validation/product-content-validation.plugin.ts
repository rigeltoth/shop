import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { UserInputError, EventBus, ProductEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { findForbiddenWord } from '../login/blacklist';

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

@Injectable()
export class ProductContentValidationSubscriber implements OnApplicationBootstrap {
    constructor(private eventBus: EventBus) {}

    onApplicationBootstrap() {
        this.eventBus.registerBlockingEventHandler({
            event: ProductEvent,
            id: 'product-content-validation',
            handler: async (event) => {
                if (event.type !== 'created' && event.type !== 'updated') return;

                const input = event.input as any;
                if (!input?.translations?.length) return;

                for (const translation of input.translations) {
                    if (translation.name) {
                        const forbidden = findForbiddenWord(translation.name);
                        if (forbidden) {
                            throw new UserInputError(
                                `El nombre del producto contiene una palabra no permitida: "${forbidden}". Elige otro nombre.`,
                            );
                        }
                    }

                    if (translation.description) {
                        if (/<img[\s>]/i.test(translation.description)) {
                            throw new UserInputError(
                                'La descripción del producto no puede contener imágenes. Elimina las imágenes y vuelve a intentar.',
                            );
                        }

                        const plainText = stripHtml(translation.description);
                        const forbidden = findForbiddenWord(plainText);
                        if (forbidden) {
                            throw new UserInputError(
                                `La descripción del producto contiene una palabra no permitida: "${forbidden}". Modifica la descripción.`,
                            );
                        }
                    }
                }
            },
        });
    }
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [ProductContentValidationSubscriber],
})
export class ProductContentValidationPlugin {}
