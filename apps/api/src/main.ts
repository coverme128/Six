import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PublicExceptionFilter } from "./common/public-exception.filter.js";
import { ApiModule } from "./module.js";

const sourceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
if (!process.env.SIX_ROOT) process.env.SIX_ROOT = sourceRoot;
process.chdir(process.env.SIX_ROOT);

async function bootstrap() {
  const app = await NestFactory.create(ApiModule, { cors: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new PublicExceptionFilter());
  await app.listen(Number(process.env.API_PORT ?? process.env.PORT ?? 4000));
}

bootstrap();
