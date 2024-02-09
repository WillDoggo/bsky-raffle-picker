import Database from "better-sqlite3";

import { DrawingsRepo } from "./model-repos/repo-drawings";
import { DrawingWinnersRepo } from "./model-repos/repo-drawing-winners";
import { DrawingWinnerRepliesRepo } from "./model-repos/repo-drawing-winner-replies";

export default class RepoManager {
	readonly drawings: DrawingsRepo;
	readonly drawingWinners: DrawingWinnersRepo;
	readonly drawingWinnerReplies: DrawingWinnerRepliesRepo;

	private readonly dbPath: string;
	private readonly dbOptions: Database.Options | undefined;

	constructor(dbPath: string, options: Database.Options | undefined = undefined) {
		this.dbPath = dbPath;
		this.dbOptions = options;

		// Adding model-specific repositories
		this.drawings = new DrawingsRepo(this);
		this.drawingWinners = new DrawingWinnersRepo(this);
		this.drawingWinnerReplies = new DrawingWinnerRepliesRepo(this);
	}

	runOnDb<TReturnData>(fn: (db: Database.Database) => TReturnData) {
		const db = new Database(this.dbPath, this.dbOptions);
		try {
			return fn(db);
		} finally {
			db.close();
		}
	}

	async runOnDbAsync<TReturnData>(fn: (db: Database.Database) => Promise<TReturnData>) {
		const db = new Database(this.dbPath, this.dbOptions);
		if (!db) {
			throw new Error(`Could not open database file`);
		}

		try {
			return await fn(db);
		} finally {
			if (db.open) {
				db.close();
			}
		}
	}

	testConnection() {
		console.log(`Testing database connection to: ${this.dbPath}`);
		let success = false;
		this.runOnDb(db => success = db.open);
		return success;
	}
}
