import BaseModelRepo from "../base-model-repo";
import RepoManager from "../repo-manager";

export interface DrawingWinnerObject {
	drawing_id: string;
	user_did: string;
}

export class DrawingWinner {
	drawingId: string;
	userDID: string;

	constructor(drawingId: string, userDID: string) {
		this.drawingId = drawingId;
		this.userDID = userDID;
	}
}

export class DrawingWinnersRepo extends BaseModelRepo<DrawingWinnerObject, DrawingWinner> {
	constructor(manager: RepoManager) {
		super(manager, `drawing_winners`);
	}

	delete(drawingId: string, userDID: string) {
		super.deleteWhere([
			{ field: `drawing_id`, comparator: `=`, value: drawingId },
			{ joiner: `AND`, field: `user_did`, comparator: `=`, value: userDID },
		]);
	}

	select(drawingId: string, userDID: string) {
		return super.selectFirstModelWhere([
			{ field: `drawing_id`, comparator: `=`, value: drawingId },
			{ joiner: `AND`, field: `user_did`, comparator: `=`, value: userDID },
		]);
	}

	selectAllForDrawing(drawingId: string) {
		return super.selectModelsWhere([
			{ field: `drawing_id`, comparator: `=`, value: drawingId },
		]);
	}

	protected override transformModelToObject(model: DrawingWinner): DrawingWinnerObject {
		return {
			drawing_id: model.drawingId,
			user_did: model.userDID,
		};
	}

	protected override transformObjectToModel(object: DrawingWinnerObject): DrawingWinner {
		return new DrawingWinner(object.drawing_id, object.user_did);
	}
}
