import { boolToNumber } from "../../utils";
import BaseModelRepo from "../base-model-repo";
import RepoManager from "../repo-manager";

export interface DrawingObject {
	id: string;
	author_did: string;
	post_id: string;
	draw_date: number;
	entries: number;
	verified: number;
}

export class Drawing {
	id: string;
	authorDID: string;
	postId: string;
	drawDate: number;
	entries: number;
	verified: boolean;

	constructor(id: string, authorDID: string, postId: string, drawDate: number, entries: number, verified: boolean) {
		this.id = id;
		this.authorDID = authorDID;
		this.postId = postId;
		this.drawDate = drawDate;
		this.entries = entries;
		this.verified = verified;
	}
}

export class DrawingsRepo extends BaseModelRepo<DrawingObject, Drawing> {
	constructor(manager: RepoManager) {
		super(manager, `drawings`);
	}

	delete(id: string) {
		super.deleteWhere([
			{ field: `id`, comparator: `=`, value: id },
		]);
	}

	select(id: string) {
		return super.selectFirstModelWhere([
			{ field: `id`, comparator: `=`, value: id },
		]);
	}

	protected override transformModelToObject(model: Drawing): DrawingObject {
		return {
			id: model.id,
			author_did: model.authorDID,
			post_id: model.postId,
			draw_date: model.drawDate,
			entries: model.entries,
			verified: boolToNumber(model.verified),
		};
	}

	protected override transformObjectToModel(object: DrawingObject): Drawing {
		return new Drawing(object.id, object.author_did, object.post_id, object.draw_date, object.entries, !!object.verified);
	}
}
