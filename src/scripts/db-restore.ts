import { gzip } from "compressing";
import { existsSync } from "fs";
import { join } from "path";

import { ConfigModule } from '@nestjs/config';
ConfigModule.forRoot();

async function main() {
	// Checking restore file from command line args
	if (process.argv.length < 3) {
		throw new Error(`Missing database backup file in command`);
	}

	const compressedDbPath = process.argv[2];
	if (!compressedDbPath || !existsSync(compressedDbPath)) {
		throw new Error(`Provided database backup file does not exist at ${compressedDbPath}`);
	}

	// Checking for db property in config.js
	const dbPath = process.env[`DB_PATH`];
	if (!dbPath) {
		throw new Error(`No db file name found in config`);
	}

	const dbFilePath = join(__dirname, `..`, `..`, dbPath);

	// Checking to see if the database file is already there
	if (existsSync(dbFilePath)) {
		throw new Error(`File already exists at ${dbFilePath}`);
	}

	// Decompressing backup file
	console.log(`Attempting to restore database from backup at ${compressedDbPath}`);
	await gzip.uncompress(compressedDbPath, dbFilePath);

	// Checking to make sure file has been decompressed
	if (!existsSync(dbFilePath)) {
		throw new Error(`Could not decompress backup file to ${dbFilePath}`);
	}
}

main()
	.then(() => console.log(`Database backup restored successfully`))
	.catch(console.error);
