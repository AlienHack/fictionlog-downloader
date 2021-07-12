import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const server = await app.listen(process.env.PORT || 3000);
  server.setTimeout(30 * 60 * 1000);
}
bootstrap();
