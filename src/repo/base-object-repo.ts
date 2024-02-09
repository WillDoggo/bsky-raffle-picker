import RepoManager from "./repo-manager";

export type SQLDataType = string | number | null;
export type SQLComparator = `=` | `!=` | `<` | `>` | `<=` | `>=`;
export type SQLOrderSort = `ASC` | `DESC`;
export type SQLWhereJoiner = `AND` | `OR`;

export interface SQLConstraint<TObject> {
	joiner?: SQLWhereJoiner;
	field: keyof TObject;
	comparator: SQLComparator;
	value: SQLDataType;
}

export interface SQLOrderField<TObject> {
	field: keyof TObject;
	sort: SQLOrderSort;
}

export interface SQLFieldValueUpdate<TObject> {
	field: keyof TObject;
	newValue: SQLDataType;
}

export default abstract class BaseObjectRepo<TObject> {
	protected readonly manager: RepoManager;
	protected readonly tableName: string;

	constructor(manager: RepoManager, tableName: string) {
		this.manager = manager;
		this.tableName = tableName;
	}

	protected deleteWhere(constraints: SQLConstraint<TObject>[]) {
		// Building and running query
		const query = `DELETE FROM "${this.tableName}" ${this.buildWhereClause(constraints)}`.trim();
		this.manager.runOnDb(db => db.prepare(query).run(constraints.map(x => x.value)));
	}

	protected insertObject(object: TObject) {
		const recordEntries = Object.entries(object as object);
		const recordKeys = recordEntries.map(x => x[0]);
		const recordValues = recordEntries.map(x => x[1]);
		const placeholders = BaseObjectRepo.buildValuePlaceholders(recordEntries.length);

		// Building and running query
		const query = `INSERT INTO "${this.tableName}" (${recordKeys.map(x => `"${x}"`).join(`,`)}) VALUES (${placeholders})`.trim();
		this.manager.runOnDb(db => db.prepare(query).run(recordValues));
	}

	protected selectAllWhere(constraints: SQLConstraint<TObject>[], order: SQLOrderField<TObject>[] = [], limit: number | undefined = undefined) {
		// Building and running query
		const query = `SELECT * FROM "${this.tableName}" ${this.buildWhereClause(constraints)} ${this.buildOrderByClause(order)} ${BaseObjectRepo.buildLimitClause(limit)}`.trim();
		return this.manager.runOnDb(db => db.prepare(query).all(constraints.map(x => x.value))).map((x: unknown) => x as TObject);
	}

	protected selectFirstWhere(constraints: SQLConstraint<TObject>[], order: SQLOrderField<TObject>[] = []) {
		return this.selectAllWhere(constraints, order)[0];
	}

	protected update(updatedValues: SQLFieldValueUpdate<TObject>[], constraints: SQLConstraint<TObject>[]) {
		// Building SET clause
		const setClauseArgPlaceholders = this.buildSetClauseArgPlaceholders(updatedValues);

		// Building WHERE clause
		const whereClauseArgPlaceholders = this.buildWhereClauseArgPlaceholders(constraints);
		const whereClause = whereClauseArgPlaceholders.length > 0 ? `WHERE ${whereClauseArgPlaceholders}` : ``;

		// Building and running query
		const query = `UPDATE "${this.tableName}" SET ${setClauseArgPlaceholders} ${whereClause}`.trim();
		return this.manager.runOnDb(db => db.prepare(query).run([...updatedValues.map(x => x.newValue), ...constraints.map(x => x.value)]));
	}

	// Private functions
	private buildOrderByClause(order: SQLOrderField<TObject>[]): string {
		return order.length > 0
			? `ORDER BY ${order.map(x => `"${x.field.toString()}" ${x.sort}`).join(`, `)}`
			: ``;
	}

	private buildSetClauseArgPlaceholders(fieldUpdates: SQLFieldValueUpdate<TObject>[]): string {
		return fieldUpdates.map(fieldUpdate => `"${fieldUpdate.field.toString()}"=?`).join(`,`);
	}

	private buildWhereClause(constraints: SQLConstraint<TObject>[]): string {
		return constraints.length > 0
			? `WHERE ${this.buildWhereClauseArgPlaceholders(constraints)}`
			: ``;
	}

	private buildWhereClauseArgPlaceholders(constraints: SQLConstraint<TObject>[]): string {
		let result = ``;
		let first = true;
		for (const constraint of constraints) {
			if (!first) {
				const joiner = constraint.joiner || `AND`;
				result += ` ${joiner} `;
			}
			result += `"${constraint.field.toString()}"${constraint.comparator}?`;
			first = false;
		}
		return result;
	}

	// Static functions
	private static buildLimitClause(count: number | undefined) {
		return count !== undefined
			? `LIMIT ${count}`
			: ``;
	}

	private static buildValuePlaceholders(n: number): string {
		const parts = [];
		for (let i = 0; i < n; i++) {
			parts.push(`?`);
		}
		return parts.join(`,`);
	}
}
