import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { BskyUtil } from './bsky/bsky-util';
import { HttpException, HttpStatus } from '@nestjs/common';

async function bootstrap() {
	ConfigModule.forRoot();
	await testBskyConnectionOrFail();
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.enableCors();
	await app.listen(parseInt(process.env[`PORT`] || ``));
}

async function testBskyConnectionOrFail() {
	console.log(`Testing initial authorization connection to Bsky...`);
	const bsky = new BskyUtil();
	await bsky.buildAuthenticatedAgent();
	if (!bsky) {
		throw new HttpException(`Unable to authorize with BlueSky`, HttpStatus.UNAUTHORIZED);
	}
	console.log(`Initial Bsky authorization connection successful`);
}

bootstrap();
