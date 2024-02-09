import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';

async function bootstrap() {
	ConfigModule.forRoot();
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	await app.listen(parseInt(process.env[`PORT`] || ``));
}
bootstrap();
