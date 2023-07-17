/* @odoo-module */
//@ts-check

import { Domain } from "@web/core/domain";
import { DynamicList } from "./dynamic_list";

export class DynamicGroupList extends DynamicList {
    static type = "DynamicGroupList";

    /**
     * @param {import("./relational_model").Config} config
     * @param {Object} data
     */
    setup(config, data) {
        super.setup(...arguments);
        this.isGrouped = true;
        this._setData(data);
    }

    _setData(data) {
        /** @type {import("./group").Group[]} */
        this.groups = data.groups.map((g) => this._createGroupDatapoint(g));
        this.count = data.length;
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    get groupBy() {
        return this.config.groupBy;
    }

    get groupByField() {
        return this.fields[this.groupBy[0].split(":")[0]];
    }

    get hasData() {
        if (this.count === 0) {
            return false;
        }
        return this.groups.some((group) => group.hasData);
    }

    /**
     * List of loaded records inside groups.
     * @returns {import("./record").Record[]}
     */
    get records() {
        return this.groups
            .filter((group) => !group.isFolded)
            .map((group) => group.records)
            .flat();
    }

    /**
     * @returns {number}
     */
    get recordCount() {
        return this.groups.reduce((acc, group) => acc + group.count, 0);
    }

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------

    async createGroup(groupName, groupData, isFolded) {
        if (!this.groupByField || this.groupByField.type !== "many2one") {
            throw new Error("Cannot create a group on a non many2one group field");
        }

        await this.model.mutex.exec(() => this._createGroup(groupName, groupData, isFolded));
    }

    async deleteGroups(groups) {
        await this.model.mutex.exec(() => this._deleteGroups(groups));
    }

    /**
     * @param {string} dataRecordId
     * @param {string} dataGroupId
     * @param {string} refId
     * @param {string} targetGroupId
     */
    async moveRecord(dataRecordId, dataGroupId, refId, targetGroupId) {
        const targetGroup = this.groups.find((g) => g.id === targetGroupId);
        if (dataGroupId === targetGroupId) {
            // move a record inside the same group
            targetGroup.list.records = await targetGroup.list._resequence(
                targetGroup.list.records,
                this.resModel,
                dataRecordId,
                refId
            );
            return;
        }

        // move record from a group to another group
        const sourceGroup = this.groups.find((g) => g.id === dataGroupId);
        const recordIndex = sourceGroup.list.records.findIndex((r) => r.id === dataRecordId);
        const record = sourceGroup.list.records[recordIndex];
        // step 1: move record to correct position
        const refIndex = targetGroup.list.records.findIndex((r) => r.id === refId);
        const oldIndex = sourceGroup.list.records.findIndex((r) => r.id === dataRecordId);
        sourceGroup._removeRecords([record.id]);
        targetGroup._addRecord(record, refIndex + 1);
        // step 2: update record value
        const value =
            targetGroup.groupByField.type === "many2one"
                ? [targetGroup.value, targetGroup.displayName]
                : targetGroup.value;
        const revert = () => {
            targetGroup._removeRecords([record.id]);
            sourceGroup._addRecord(record, oldIndex);
        };
        try {
            await record.update({ [targetGroup.groupByField.name]: value });
            const res = await record.save({ noReload: true });
            if (!res) {
                revert();
            }
        } catch (e) {
            // revert changes
            revert();
            throw e;
        }
        if (!targetGroup.isFolded) {
            targetGroup.list.records = await targetGroup.list._resequence(
                targetGroup.list.records,
                this.resModel,
                dataRecordId,
                refId
            );
        }
    }

    async resequence(movedGroupId, targetGroupId) {
        if (!this.groupByField || this.groupByField.type !== "many2one") {
            throw new Error("Cannot resequence a group on a non many2one group field");
        }

        return this.model.mutex.exec(async () => {
            this.groups = await this._resequence(
                this.groups,
                this.groupByField.relation,
                movedGroupId,
                targetGroupId
            );
        });
    }

    async sortBy(fieldName) {
        if (!this.groups.length) {
            return;
        }
        if (this.groups.every((group) => group.isFolded)) {
            // all groups are folded
            if (this.groupByField.name !== fieldName) {
                // grouped by another field than fieldName
                if (!(fieldName in this.groups[0].aggregates)) {
                    // fieldName has no aggregate values
                    return;
                }
            }
        }
        return super.sortBy(fieldName);
    }

    // -------------------------------------------------------------------------
    // Protected
    // -------------------------------------------------------------------------

    async _createGroup(groupName, groupData = {}, isFolded = false) {
        groupData = { ...groupData, name: groupName };
        const [id] = await this.model.orm.create(this.groupByField.relation, [groupData], {
            context: this.context,
        });
        const lastGroup = this.groups.at(-1);

        // This is almost a copy/past of the code in relational_model.js
        // Maybe we can create an addGroup method in relational_model.js
        // and call it from here and from relational_model.js
        const commonConfig = {
            resModel: this.config.resModel,
            fields: this.config.fields,
            activeFields: this.config.activeFields,
        };
        const context = {
            ...this.context,
            [`default_${this.groupByField.name}`]: id,
        };
        const nextConfigGroups = { ...this.config.groups };
        const domain = Domain.and([this.domain, [[this.groupByField.name, "=", id]]]).toList();
        nextConfigGroups[id] = {
            ...commonConfig,
            context,
            groupByFieldName: this.groupByField.name,
            isFolded,
            initialDomain: domain,
            list: {
                ...commonConfig,
                context,
                domain: domain,
                groupBy: [],
                orderBy: this.orderBy,
            },
        };
        this.model._updateConfig(this.config, { groups: nextConfigGroups }, { noReload: true });

        const data = {
            count: 0,
            length: 0,
            records: [],
            __domain: domain,
            [this.groupByField.name]: [id, groupName],
            value: id,
            displayName: groupName,
        };

        const group = this._createGroupDatapoint(data);
        if (lastGroup) {
            const groups = [...this.groups, group];
            this.groups = await this._resequence(
                groups,
                this.groupByField.relation,
                group.id,
                lastGroup.id
            );
        } else {
            this.groups.push(group);
        }
    }

    _createGroupDatapoint(data) {
        return new this.model.constructor.Group(this.model, this.config.groups[data.value], data);
    }

    async _deleteGroups(groups) {
        const shouldReload = groups.some((g) => g.count > 0);
        await this._unlinkGroups(groups);
        if (shouldReload) {
            const configGroups = { ...this.config.groups };
            for (const group of groups) {
                delete configGroups[group.value];
            }
            await this.model._updateConfig(
                this.config,
                { groups: configGroups },
                { commit: this._setData.bind(this) }
            );
        } else {
            for (const group of groups) {
                this._removeGroup(group);
            }
        }
    }

    _getDPresId(group) {
        return group.value;
    }

    _getDPHandleField(group) {
        return group[this.handleField];
    }

    async _load(offset, limit, orderBy, domain) {
        await this.model._updateConfig(
            this.config,
            { offset, limit, orderBy, domain },
            { commit: this._setData.bind(this) }
        );
    }

    _removeGroup(group) {
        const index = this.groups.findIndex((g) => g.id === group.id);
        this.groups.splice(index, 1);
        this.count--;
    }

    _removeRecords(recordIds) {
        const proms = [];
        for (const group of this.groups) {
            proms.push(group._removeRecords(recordIds));
        }
        return Promise.all(proms);
    }

    _unlinkGroups(groups) {
        const groupResIds = groups.map((g) => g.value);
        return this.model.orm.unlink(this.groupByField.relation, groupResIds, {
            context: this.context,
        });
    }
}
