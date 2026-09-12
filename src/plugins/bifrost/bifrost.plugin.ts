import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BIFROST_PLUGIN_OPTIONS } from './constants';
import { BifrostPluginInitOptions } from './interfaces';
import { BifrostKey } from './entities';
import { BifrostClient, BifrostService } from './services';
import { BifrostResolver } from './api';
import { bifrostApiExtensions } from './api/api-extensions';
import { DEFAULT_BIFROST_BASE_URL } from './constants';

@Global()
@Module({
    imports: [PluginCommonModule, TypeOrmModule.forFeature([BifrostKey])],
    providers: [
        {
            provide: BIFROST_PLUGIN_OPTIONS,
            useFactory: () => BifrostPlugin.options,
        },
        BifrostClient,
        BifrostService,
        BifrostResolver,
    ],
    exports: [BIFROST_PLUGIN_OPTIONS, BifrostClient, BifrostService],
})
export class BifrostModule { }

@VendurePlugin({
    imports: [PluginCommonModule, BifrostModule],
    entities: [BifrostKey as Type<any>],
    providers: [
        {
            provide: BIFROST_PLUGIN_OPTIONS,
            useFactory: () => BifrostPlugin.options,
        },
    ],
    adminApiExtensions: {
        schema: bifrostApiExtensions,
        resolvers: [BifrostResolver],
    },
    shopApiExtensions: {
        schema: bifrostApiExtensions,
        resolvers: [BifrostResolver],
    },
    configuration: (config) => config,
    compatibility: '^3.0.0',
})
export class BifrostPlugin {
    static options: BifrostPluginInitOptions;

    static init(options: BifrostPluginInitOptions): Type<BifrostPlugin> {
        this.options = {
            bifrostBaseUrl: options.bifrostBaseUrl || process.env.BIFROST_BASE_URL || DEFAULT_BIFROST_BASE_URL,
            bifrostAdminUser: options.bifrostAdminUser || process.env.BIFROST_ADMIN_USER || '',
            bifrostAdminPassword: options.bifrostAdminPassword || process.env.BIFROST_ADMIN_PASSWORD || '',
        };
        return BifrostPlugin;
    }
}
