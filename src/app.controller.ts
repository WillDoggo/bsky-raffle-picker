import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { BskyUtil } from './bsky/bsky-util';
import { ParsePostDto } from './dto/parse-post.dto';
import { VerifyHandleDto } from './dto/verify-handle.dto';
import { DrawWinnersDto } from './dto/draw-winners.dto';
import RepoManager from './repo/repo-manager';
import { Drawing } from './repo/model-repos/repo-drawings';
import { randomUUID } from 'crypto';
import { DrawingWinner } from './repo/model-repos/repo-drawing-winners';
import { DrawingWinnerReply } from './repo/model-repos/repo-drawing-winner-replies';

function getRepoManager() {
	return new RepoManager(process.env[`DB_PATH`] || ``, { fileMustExist: true });
}

@Controller()
export class AppController {
	// GET /drawing/:id
	@Get(`drawing/:id`)
	async getDrawing(@Param() params: Record<string, string>) {
		// Getting drawing id from params
		const id = (params[`id`] || ``).trim();
		if (id.length < 1) {
			throw new HttpException(`Missing drawing id`, HttpStatus.BAD_REQUEST);
		}

		// Looking up drawing & winners info
		const repoManager = getRepoManager();
		const drawing = repoManager.drawings.select(id);
		if (!drawing) {
			throw new HttpException(`Drawing with id "${id}" not found`, HttpStatus.NOT_FOUND);
		}

		const winners = repoManager.drawingWinners.selectAllForDrawing(id);
		if (!winners || winners.length < 1) {
			throw new HttpException(`Winners for drawing with id "${id}" not found`, HttpStatus.NOT_FOUND);
		}

		const replies = {} as Record<string, string[]>;
		for (const winner of winners) {
			const repliesFromWinner = repoManager.drawingWinnerReplies.selectAllForDrawingWinner(id, winner.userDID);
			replies[winner.userDID] = repliesFromWinner.map(x => x.replyUri);
		}

		// Pulling info from bsky util
		const bsky = new BskyUtil();
		const drawingWinnersInfo = await bsky.getDrawingWinnersInfo(drawing.authorDID,
			drawing.postId,
			winners.map(x => x.userDID),
			replies);

		return {
			drawing: drawing,
			post: drawingWinnersInfo.post,
			winners: drawingWinnersInfo.winners,
			winnerReplies: drawingWinnersInfo.winnerReplies,
		};
	}

	// POST /draw
	@Post(`draw`)
	async drawInners(@Body() body: DrawWinnersDto) {
		// Setting up repo manager
		const repoManager = getRepoManager();

		// Drawing random winner(s)
		const bsky = new BskyUtil();
		const results = await bsky.drawWinners(body.uri, body.options);

		// Creating Drawing model and storing in DB
		const drawingId = randomUUID();
		const drawing = new Drawing(drawingId,
			results.postInfo.post.author.did,
			results.postInfo.postId,
			Math.floor(new Date().getTime()),
			results.entries.length,
			results.verified);
		repoManager.drawings.insert(drawing);

		// Looping through winners
		for (const winner of results.winners) {
			// Creating drawing winner model and storing in DB
			const drawingWinner = new DrawingWinner(drawingId, winner.did);
			repoManager.drawingWinners.insert(drawingWinner);

			// If any exist, looping through winner replies
			const replies = results.winningReplies
				? results.winningReplies[winner.handle]
				: undefined;

			if (replies) {
				for (const winnerReply of replies) {
					// Creating drawing winner reply model and storing in DB
					const drawingWinnerReply = new DrawingWinnerReply(winnerReply.uri, drawingId, winner.did);
					repoManager.drawingWinnerReplies.insert(drawingWinnerReply);
				}
			}
		}

		return {
			drawingId: drawingId,
		};
	}

	// POST /parse
	@Post(`parse`)
	async parsePost(@Body() body: ParsePostDto) {
		const bsky = new BskyUtil();
		return await bsky.getPostInformationFromWeb(body.uri);
	}

	// POST /verify
	@Post(`verify`)
	async verifyHandle(@Body() body: VerifyHandleDto) {
		const bsky = new BskyUtil();
		return await bsky.verifyHandle(body.handle, body.password);
	}
}
