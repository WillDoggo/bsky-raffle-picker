CREATE TABLE IF NOT EXISTS drawings (
	id TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
	author_did TEXT NOT NULL,
	post_id TEXT NOT NULL,
	draw_date INTEGER NOT NULL,
	entries INTEGER NOT NULL,
	verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS drawing_winners (
	drawing_id TEXT NOT NULL COLLATE NOCASE,
	user_did TEXT NOT NULL,
	PRIMARY KEY (drawing_id, user_did),
	FOREIGN KEY (drawing_id) REFERENCES drawings(id)
);
CREATE TABLE IF NOT EXISTS drawing_winner_replies (
	reply_uri TEXT NOT NULL,
	drawing_id TEXT NOT NULL COLLATE NOCASE,
	user_did TEXT NOT NULL,
	PRIMARY KEY (drawing_id, reply_uri),
	FOREIGN KEY (drawing_id) REFERENCES drawings(id)
);
