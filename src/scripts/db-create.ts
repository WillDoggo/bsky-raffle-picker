import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";

import { ConfigModule } from '@nestjs/config';
ConfigModule.forRoot();

const schemaFilePath = join(__dirname, `..`, `..`, `db_schema.sql`);

function createOrOpenDatabase(dbFilePath: string): Database.Database {
	if (existsSync(dbFilePath)) {
		console.log(`Opening already-existing database file at ${dbFilePath}`);
		try {
			const db = new Database(dbFilePath.toString(), { fileMustExist: true, verbose: console.log });
			if (!db.open) {
				throw new Error(`Could not open database file at ${dbFilePath}`);
			}
			return db;
		} catch (err) {
			console.error(err);
			console.error(`Could not open existing database file`);
			throw err;
		}
	}

	// Creating DB file if it does not exist
	console.log(`Database file does not exist at ${dbFilePath}`);
	console.log(`Creating new database`);
	try {
		const db = new Database(dbFilePath.toString(), { verbose: console.log });
		if (!db.open) {
			throw new Error(`Could not open database file at ${dbFilePath}`);
		}
		return db;
	} catch (err) {
		console.error(err);
		console.error(`Could not create database file`);
		throw err;
	}
}

// Checking for db property in config.js
const dbPath = process.env[`DB_PATH`];
if (!dbPath) {
	throw new Error(`No DB path value found in env vars`);
}

// Checking for db_schema.sql file
if (!existsSync(schemaFilePath)) {
	throw new Error(`No DB schema file found at ${schemaFilePath}`);
}

// Reading DB schema file queries.
const schemaSql = readFileSync(schemaFilePath, { encoding: `utf8`, flag: `r` });
if (!schemaSql || schemaSql.trim().length < 1) {
	throw new Error(`Could not read DB schema file`);
}

const dbFilePath = join(__dirname, `..`, `..`, dbPath);
const dbDirPath = dirname(dbFilePath);

// Creating DB directory
if (!existsSync(dbDirPath)) {
	console.log(`Database directory does not exist at ${dbDirPath}`);
	console.log(`Creating directory`);
	try {
		mkdirSync(dbDirPath);
		console.log(`Directory created`);
	} catch (err) {
		console.error(err);
		throw new Error(`Could not create database directory`);
	}
}

const db = createOrOpenDatabase(dbFilePath);
if (!db) {
	throw new Error(`Error creating or opening database`);
}

try {
	console.log(`Database opened successfully`);
	console.log(db);
	console.log(`Running schema operations`);
	db.exec(schemaSql);
} finally {
	if (db.open) {
		db.close();
		console.log(`Database closed`);
	}
}

console.log(`Script completed successfully`);
