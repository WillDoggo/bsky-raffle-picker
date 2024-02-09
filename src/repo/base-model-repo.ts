import BaseObjectRepo, { SQLConstraint, SQLOrderField } from "./base-object-repo";
import RepoManager from "./repo-manager";

export default abstract class BaseModelRepo<TObject, TModel> extends BaseObjectRepo<TObject> {
	constructor(manager: RepoManager, tableName: string) {
		super(manager, tableName);
	}

	insert(item: TModel) {
		super.insertObject(this.transformModelToObject(item));
	}

	protected selectModelsWhere(constraints: SQLConstraint<TObject>[], order: SQLOrderField<TObject>[] = [], limit: number | undefined = undefined) {
		return super.selectAllWhere(constraints, order, limit)
			.map(o => this.transformObjectToModel(o));
	}

	protected selectFirstModelWhere(constraints: SQLConstraint<TObject>[], order: SQLOrderField<TObject>[] = []) {
		return this.selectModelsWhere(constraints, order)[0];
	}

	protected abstract transformModelToObject(model: TModel): TObject;
	protected abstract transformObjectToModel(object: TObject): TModel;
}
