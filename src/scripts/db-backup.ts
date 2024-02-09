import BetterSqlite3, { Database } from "better-sqlite3";
import { gzip } from "compressing";
import { existsSync, mkdirSync, rmSync } from "fs";
import { basename, dirname, extname, join } from "path";

import { ConfigModule } from '@nestjs/config';
ConfigModule.forRoot();

const dbBackupDirName = `backups`;

function formatDate(date: Date) {
	return date
		.toISOString()
		.replaceAll(`-`, ``)
		.replaceAll(`:`, ``)
		.replaceAll(`.`, ``);
}

async function dumpDatabase(db: Database, dbBackupPath: string, customName: string | undefined = undefined) {
	const ts = formatDate(new Date());
	const baseDbName = basename(db.name, extname(db.name));
	const rawBackupBaseName = customName || `${baseDbName}_${ts}`;
	const rawBackupPath = join(dbBackupPath, `${rawBackupBaseName}.sqlite3`);
	const gzBackupPath = `${rawBackupPath}.gz`;

	if (existsSync(rawBackupPath)) {
		throw new Error(`File already exists at ${rawBackupPath}`);
	}
	if (existsSync(gzBackupPath)) {
		throw new Error(`File already exists at ${gzBackupPath}`);
	}

	console.log(`Starting backup to raw database file at ${rawBackupPath}`);
	await db.backup(rawBackupPath);

	if (!existsSync(rawBackupPath)) {
		throw new Error(`Could not create database backup`);
	}

	console.log(`Backup created`);
	console.log(`Beginning compression to ${gzBackupPath}`);
	await gzip.compressFile(rawBackupPath, gzBackupPath);

	if (!existsSync(gzBackupPath)) {
		throw new Error(`Could not compress database backup, leaving uncompressed backup file as-is`);
	}

	console.log(`Database backup compressed to ${gzBackupPath}`);
	console.log(`Deleting uncompressed database backup file`);
	rmSync(rawBackupPath);
}

// Checking for db property in config.js
const dbPath = process.env[`DB_PATH`];
if (!dbPath) {
	throw new Error(`No db file name found in config`);
}

const dbFilePath = join(__dirname, `..`, `..`, dbPath);
const dbDirPath = dirname(dbFilePath);

if (!existsSync(dbDirPath)) {
	throw new Error(`Database directory does not exist at ${dbDirPath}`);
}

// Creating DB backup directory
const dbBackupPath = join(dbDirPath, dbBackupDirName);
if (!existsSync(dbBackupPath)) {
	console.log(`Database backup directory does not exist at ${dbBackupPath}`);
	try {
		mkdirSync(dbBackupPath);
		console.log(`Directory created`);
	} catch (err) {
		console.error(err);
		throw new Error(`Could not create database backup directory`);
	}
}

const db = new BetterSqlite3(dbFilePath, { fileMustExist: true, verbose: console.log });
if (!db) {
	throw new Error(`Error opening database`);
}

console.log(`Database opened successfully`);
console.log(db);

let customName: string | undefined;
if (process.argv.length > 2 && process.argv[2]) {
	customName = process.argv[2].trim();
}

dumpDatabase(db, dbBackupPath, customName)
	.then(() => console.log(`Database backup completed successfully`))
	.catch(err => {
		console.error(err);
		console.log(`Database backup failed`);
	})
	.finally(() => {
		if (db && db.open) {
			db.close();
			console.log(`Database closed`);
		}
	});
