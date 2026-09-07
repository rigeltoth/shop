import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config';
import { NestExpressApplication } from '@nestjs/platform-express';

runMigrations(config)
  .then(() => bootstrap(config, { nestApplicationOptions: { rawBody: true } }))
  .then((app) => {
    (app as NestExpressApplication).set('trust proxy', 1);
  })
  .catch((err) => {
    console.error(err);
  });
