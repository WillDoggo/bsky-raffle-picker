import { BskyAgent } from "@atproto/api";
import { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { PostView, ThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { HttpException, HttpStatus } from "@nestjs/common";
import { shuffle } from "../utils";
import { DrawOptions } from "../dto/draw-winners.dto";

interface WinningReply {
	uri: string;
	record: object;
	embed: object | undefined;
}

export class BskyUtil {
	async drawWinners(postUri: string,
		options: DrawOptions | undefined = undefined,
		agent: BskyAgent | undefined = undefined) {

		const components = this.getUriComponents(postUri);

		let verified = false;
		const winnerCount = options?.winnerCount || 1;
		const requireRepost = options?.requireRepost || false;
		const requireLike = options?.requireLike || false;
		const requireFollow = options?.requireFollow || false;
		const requireReply = options?.requireReply || false;
		const requireReplyImage = options?.requireReplyImage || false;

		let agentIdentifier: string | undefined = undefined;
		let agentPassword: string | undefined = undefined;

		if (options && options.password) {
			verified = (await this.verifyHandle(components.authorHandle, options.password)).verified;
			agentIdentifier = components.authorHandle;
			agentPassword = options.password;
		}

		// Logging in if no agent is supplied
		if (!agent) {
			agent = await this.buildAuthenticatedAgent(agentIdentifier, agentPassword);
		}

		// Grabbing the post info
		const postInfo = await this.getPostInformationFromWeb(postUri, agent);

		// Starting entries set with union of all interactions
		const entrySet = new Set<string>([
			...postInfo.likedBy,
			...postInfo.repostedBy,
			...postInfo.replies.map(x => x.author.handle)]);

		// First, remove author from the pool
		entrySet.delete(postInfo.post.author.handle);

		// Narrow down entries based on requirements
		let entries = [...entrySet];
		if (requireRepost) {
			entries = entries.filter(x => postInfo.repostedBy.includes(x));
		}
		if (requireLike) {
			entries = entries.filter(x => postInfo.likedBy.includes(x));
		}
		if (requireFollow) {
			entries = entries.filter(x => postInfo.authorFollowers.includes(x));
		}

		// If expecting entrants to have replied,
		// we'll want to make sure to return those replies and not just the user handles
		let entrantReplies: PostView[] | undefined = undefined;

		// If only regular replies are required
		if (requireReply && !requireReplyImage) {
			entrantReplies = postInfo.replies;
		}

		// If replies with images are required
		if (requireReplyImage) {
			entrantReplies = postInfo.replies.filter(reply => !!reply.embed);
		}

		// Filtering down entry handles list based on replies
		if (entrantReplies) {
			const entrantReplyHandles = entrantReplies.map(reply => reply.author.handle);
			entries = entries.filter(handle => entrantReplyHandles.includes(handle));
		}

		// If no entries remain, throw an error
		if (entries.length < 1) {
			throw new HttpException(`Post has no eligible entries based on provided options`, HttpStatus.NOT_FOUND);
		}

		// Shuffling list of entrant handles
		shuffle(entries);

		// Getting winners by slicing shuffled array
		const winnerHandles = entries.slice(0, winnerCount);
		let winners: ProfileViewDetailed[];

		try {
			const winnerProfilesResult = await agent.getProfiles({
				actors: winnerHandles,
			});
			if (!winnerProfilesResult.success) {
				throw new HttpException(`Could not fetch profiles of winners`, HttpStatus.INTERNAL_SERVER_ERROR);
			}
			winners = winnerProfilesResult.data.profiles;
		} catch (err) {
			throw new HttpException(`Could not fetch profiles of winners`, HttpStatus.INTERNAL_SERVER_ERROR);
		}

		// If entrant replies are required, build a dictionary of the winner(s)' replies
		let winningReplies: Record<string, WinningReply[]> | undefined = undefined;
		if (entrantReplies) {
			winningReplies = {} as Record<string, WinningReply[]>;
			for (const winner of winnerHandles) {
				winningReplies[winner] = entrantReplies
					.filter(reply => reply.author.handle == winner)
					.map(reply => {
						return {
							uri: reply.uri,
							record: reply.record,
							embed: reply.embed,
						} as WinningReply;
					});
			}
		}

		return {
			postInfo: postInfo,
			winners: winners,
			winningReplies: winningReplies,
			entries: entries.sort(),
			requestedWinnerCount: winnerCount,
			verified: verified,
		};
	}

	async getPostInformationFromWeb(postWebUri: string,
		agent: BskyAgent | undefined = undefined,
		identifier: string | undefined = undefined,
		password: string | undefined = undefined) {

		// Breaking provided URI into components
		const components = this.getUriComponents(postWebUri);

		// Logging in if no agent is supplied
		if (!agent) {
			agent = await this.buildAuthenticatedAgent(identifier, password);
		}

		// Getting post author
		let authorDID: string;
		try {
			const authorResult = await agent.getProfile({
				actor: components.authorHandle,
			});
			if (!authorResult.success) {
				throw new HttpException(`Unable to find BlueSky profile with handle "${components.authorHandle}"`, HttpStatus.NOT_FOUND);
			}
			authorDID = authorResult.data.did;
		} catch (err) {
			throw new HttpException(`Unable to find BlueSky profile with handle "${components.authorHandle}"`, HttpStatus.NOT_FOUND);
		}

		return await this.getPostInformation(authorDID, components.postId, agent, identifier, password);
	}

	async getPostInformation(authorDID: string,
		postId: string,
		agent: BskyAgent | undefined = undefined,
		identifier: string | undefined = undefined,
		password: string | undefined = undefined) {

		// Logging in if no agent is supplied
		if (!agent) {
			agent = await this.buildAuthenticatedAgent(identifier, password);
		}

		// Getting post author
		let author: ProfileViewDetailed;
		try {
			const authorResult = await agent.getProfile({
				actor: authorDID,
			});
			if (!authorResult.success) {
				throw new HttpException(`Unable to find BlueSky profile with DID "${authorDID}"`, HttpStatus.NOT_FOUND);
			}
			author = authorResult.data;
		} catch (err) {
			throw new HttpException(`Unable to find BlueSky profile with DID "${authorDID}"`, HttpStatus.NOT_FOUND);
		}

		// Getting post details
		let thread: ThreadViewPost;
		try {
			const threadResult = await agent.getPostThread({
				uri: this.buildPostUri(authorDID, postId),
				parentHeight: 0,
				depth: 1,
			});
			if (!threadResult.success) {
				throw new HttpException(`Unable to find BlueSky post with ID "${postId}", or the post is blocked`, HttpStatus.NOT_FOUND);
			}
			if (threadResult.data.thread.$type != `app.bsky.feed.defs#threadViewPost`) {
				throw new HttpException(`Unable to find BlueSky post with ID "${postId}", or the post is blocked`, HttpStatus.NOT_FOUND);
			}
			thread = threadResult.data.thread as ThreadViewPost;
		} catch (err) {
			throw new HttpException(`Unable to find BlueSky post with ID "${postId}", or the post is blocked`, HttpStatus.NOT_FOUND);
		}

		// Getting post replies
		const replies = thread.replies
			? (thread.replies.filter(x => x.$type == `app.bsky.feed.defs#threadViewPost`).map(x => (x as ThreadViewPost).post))
			: ([] as PostView[]);

		// Getting author followers
		let authorFollowers: string[];
		try {
			authorFollowers = await this.getAllFollowers(agent, author.did);
		} catch (err) {
			console.error(err);
			throw new HttpException(`Unable to fetch post author's follower list`, HttpStatus.INTERNAL_SERVER_ERROR);
		}

		return {
			post: thread.post,
			postId: postId,
			replies: replies,
			repostedBy: (await this.getAllRepostedBy(agent, thread.post.uri)),
			likedBy: (await this.getAllLikedBy(agent, thread.post.uri)),
			authorFollowers: authorFollowers,
		};
	}

	async verifyHandle(handle: string, password: string) {
		this.verifyAppPassword(password);

		// Logging in
		const agent = await this.buildAuthenticatedAgent(handle, password);
		return { verified: agent.hasSession };
	}

	async getDrawingWinnersInfo(authorDID: string,
		postId: string,
		winnerDIDs: string[],
		winnerReplyUris: Record<string, string[]>,
		agent: BskyAgent | undefined = undefined,
		identifier: string | undefined = undefined,
		password: string | undefined = undefined) {

		// Logging in if no agent is supplied
		if (!agent) {
			agent = await this.buildAuthenticatedAgent(identifier, password);
		}

		let post: PostView;
		try {
			const threadResponse = await agent.getPostThread({
				uri: this.buildPostUri(authorDID, postId),
				depth: 0,
				parentHeight: 0,
			});
			if (!threadResponse.success) {
				throw new HttpException(`Unable to fetch raffle post with ID "${postId}" from BlueSky`, HttpStatus.NOT_FOUND);
			}
			if (threadResponse.data.thread.$type != `app.bsky.feed.defs#threadViewPost`) {
				throw new HttpException(`Unable to find BlueSky post with ID "${postId}", or the post is blocked`, HttpStatus.NOT_FOUND);
			}
			post = (threadResponse.data.thread as ThreadViewPost).post;
		} catch (err) {
			throw new HttpException(`Unable to fetch raffle post with ID "${postId}" from BlueSky`, HttpStatus.NOT_FOUND);
		}

		const getWinnersResponse = await agent.getProfiles({
			actors: winnerDIDs,
		});
		if (!getWinnersResponse.success) {
			throw new HttpException(`Unable to fetch winner profiles`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
		const winners = getWinnersResponse.data.profiles;
		const winnerReplies = {} as Record<string, { uri: string, text: string, embed: object | undefined }[]>;
		const winnerReplyUriEntries = Object.entries(winnerReplyUris);
		for (const winnerReplyUriEntry of winnerReplyUriEntries) {
			const winnerDID = winnerReplyUriEntry[0];
			const replyUris = winnerReplyUriEntry[1];
			const getPostsResponse = await agent.getPosts({
				uris: replyUris,
			});
			if (getPostsResponse.success) {
				winnerReplies[winnerDID] = getPostsResponse.data.posts.map(x => {
					const record = x.record as Record<string, unknown>;
					return {
						uri: x.uri,
						text: record[`text`] as string || ``,
						embed: x.embed,
					};
				});
			}
		}

		return {
			post: post,
			winners: winners,
			winnerReplies: winnerReplies,
		};
	}

	private buildAgent() {
		return new BskyAgent({
			service: `https://bsky.social`,
		});
	}

	async buildAuthenticatedAgent(identifier: string | undefined = undefined, password: string | undefined = undefined) {
		// Logging in
		const agent = this.buildAgent();
		try {
			await agent.login({
				identifier: identifier || process.env[`BSKY_IDENTIFIER`] || ``,
				password: password || process.env[`BSKY_PASSWORD`] || ``,
			});
		} catch (err) {
			throw new HttpException(`Unable to authorize with BlueSky`, HttpStatus.UNAUTHORIZED);
		}
		if (!agent.hasSession) {
			throw new HttpException(`Unable to authorize with BlueSky`, HttpStatus.UNAUTHORIZED);
		}
		return agent;
	}

	private async getAllFollowers(agent: BskyAgent, did: string) {
		const followers = [];
		let cursor = ``;
		let lastCursor = cursor;

		do {
			const followersResult = await agent.getFollowers({
				actor: did,
				limit: 100,
				cursor: cursor,
			});
			if (!followersResult.success) {
				throw new HttpException(`Unable to fetch post author's follower list`, HttpStatus.INTERNAL_SERVER_ERROR);
			}
			followers.push(...followersResult.data.followers.map(x => x.handle));
			lastCursor = cursor;
			cursor = followersResult.data.cursor || ``;
		} while (cursor && cursor != lastCursor);

		return followers;
	}

	private async getAllLikedBy(agent: BskyAgent, postUri: string) {
		const likedBy = [];
		let cursor = ``;
		let lastCursor = cursor;

		do {
			const likedByResult = await agent.getLikes({
				uri: postUri,
				limit: 100,
				cursor: cursor,
			});
			if (!likedByResult.success) {
				throw new HttpException(`Unable to fetch post likes`, HttpStatus.INTERNAL_SERVER_ERROR);
			}
			likedBy.push(...likedByResult.data.likes.map(x => x.actor.handle));
			lastCursor = cursor;
			cursor = likedByResult.data.cursor || ``;
		} while (cursor && cursor != lastCursor);

		return likedBy;
	}

	private async getAllRepostedBy(agent: BskyAgent, postUri: string) {
		const repostedBy = [];
		let cursor = ``;
		let lastCursor = cursor;

		do {
			const repostedByResult = await agent.getRepostedBy({
				uri: postUri,
				limit: 100,
				cursor: cursor,
			});
			if (!repostedByResult.success) {
				throw new HttpException(`Unable to fetch post likes`, HttpStatus.INTERNAL_SERVER_ERROR);
			}
			repostedBy.push(...repostedByResult.data.repostedBy.map(x => x.handle));
			lastCursor = cursor;
			cursor = repostedByResult.data.cursor || ``;
		} while (cursor && cursor != lastCursor);

		return repostedBy;
	}

	private getUriComponents(postUri: string) {
		if (!postUri || !postUri.length) {
			throw new HttpException(`Missing or invalid BlueSky post URI`, HttpStatus.BAD_REQUEST);
		}

		const postUriRegex = /bsky\.app\/profile\/([^/]+)\/post\/([a-z0-9_-]+)/gm;
		const matches = postUriRegex.exec(postUri);
		if (!matches || matches.length < 3) {
			throw new HttpException(`Missing or invalid BlueSky post URI`, HttpStatus.BAD_REQUEST);
		}

		const authorHandle = matches[1];
		if (!authorHandle || !authorHandle.length) {
			throw new HttpException(`Missing or invalid BlueSky post URI`, HttpStatus.BAD_REQUEST);
		}

		const postId = matches[2];
		if (!postId || !postId.length) {
			throw new HttpException(`Missing or invalid BlueSky post URI`, HttpStatus.BAD_REQUEST);
		}

		return {
			authorHandle: authorHandle,
			postId: postId,
		};
	}

	private verifyAppPassword(password: string) {
		const appPasswordRegex = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/gm;
		if (!appPasswordRegex.exec(password)) {
			throw new HttpException(`Non-app password provided, please generate an app password at https://bsky.app/settings/app-passwords`, HttpStatus.BAD_REQUEST);
		}
	}

	private buildPostUri(authorDID: string, postId: string) {
		return `at://${authorDID}/app.bsky.feed.post/${postId}`;
	}
}
