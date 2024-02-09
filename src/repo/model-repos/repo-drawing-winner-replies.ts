import BaseModelRepo from "../base-model-repo";
import RepoManager from "../repo-manager";

export interface DrawingWinnerReplyObject {
	reply_uri: string;
	drawing_id: string;
	user_did: string;
}

export class DrawingWinnerReply {
	replyUri: string;
	drawingId: string;
	userDID: string;

	constructor(replyUri: string, drawingId: string, userDID: string) {
		this.replyUri = replyUri;
		this.drawingId = drawingId;
		this.userDID = userDID;
	}
}

export class DrawingWinnerRepliesRepo extends BaseModelRepo<DrawingWinnerReplyObject, DrawingWinnerReply> {
	constructor(manager: RepoManager) {
		super(manager, `drawing_winner_replies`);
	}

	delete(replyUri: string) {
		super.deleteWhere([
			{ field: `reply_uri`, comparator: `=`, value: replyUri },
		]);
	}

	select(replyUri: string) {
		return super.selectFirstModelWhere([
			{ field: `reply_uri`, comparator: `=`, value: replyUri },
		]);
	}

	selectAllForDrawing(drawingId: string) {
		return super.selectModelsWhere([
			{ field: `drawing_id`, comparator: `=`, value: drawingId },
		]);
	}

	selectAllForDrawingWinner(drawingId: string, userDID: string) {
		return super.selectModelsWhere([
			{ field: `drawing_id`, comparator: `=`, value: drawingId },
			{ joiner: `AND`, field: `user_did`, comparator: `=`, value: userDID },
		]);
	}

	protected override transformModelToObject(model: DrawingWinnerReply): DrawingWinnerReplyObject {
		return {
			reply_uri: model.replyUri,
			drawing_id: model.drawingId,
			user_did: model.userDID,
		};
	}

	protected override transformObjectToModel(object: DrawingWinnerReplyObject): DrawingWinnerReply {
		return new DrawingWinnerReply(object.reply_uri, object.drawing_id, object.user_did);
	}
}
