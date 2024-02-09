export interface DrawOptions {
	winnerCount?: number | undefined;
	requireRepost?: boolean | undefined;
	requireLike?: boolean | undefined;
	requireFollow?: boolean | undefined;
	requireReply?: boolean | undefined;
	requireReplyImage?: boolean | undefined;
	password?: string | undefined;
}

export class DrawWinnersDto {
	uri!: string;
	options?: DrawOptions | undefined;
}
