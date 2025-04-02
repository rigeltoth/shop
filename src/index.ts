import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config';
import { NestExpressApplication } from '@nestjs/platform-express';

//runMigrations(config)
//    .then(() => bootstrap(config))
//    .catch(err => {
//        console.log(err);
//    });
    
runMigrations(config)
    .then(() => bootstrap(config))
    .then((app) => { // there may be a more plugin-y way to do this but idk it
        (app as NestExpressApplication).set('trust proxy', 1);
    })
    .catch((err) => { console.error(err); });