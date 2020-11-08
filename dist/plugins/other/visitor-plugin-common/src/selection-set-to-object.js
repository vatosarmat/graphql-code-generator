import { Kind, isObjectType, isUnionType, isInterfaceType, SchemaMetaFieldDef, TypeMetaFieldDef, isListType, isNonNullType, } from 'graphql';
import { getPossibleTypes, separateSelectionSet, getFieldNodeNameValue, DeclarationBlock, mergeSelectionSets, } from './utils';
import { getBaseType } from '@graphql-codegen/plugin-helpers';
import autoBind from 'auto-bind';
function isMetadataFieldName(name) {
    return ['__schema', '__type'].includes(name);
}
const metadataFieldMap = {
    __schema: SchemaMetaFieldDef,
    __type: TypeMetaFieldDef,
};
export class SelectionSetToObject {
    constructor(_processor, _scalars, _schema, _convertName, _getFragmentSuffix, _loadedFragments, _config, _parentSchemaType, _selectionSet) {
        this._processor = _processor;
        this._scalars = _scalars;
        this._schema = _schema;
        this._convertName = _convertName;
        this._getFragmentSuffix = _getFragmentSuffix;
        this._loadedFragments = _loadedFragments;
        this._config = _config;
        this._parentSchemaType = _parentSchemaType;
        this._selectionSet = _selectionSet;
        this._primitiveFields = [];
        this._primitiveAliasedFields = [];
        this._linksFields = [];
        this._queriedForTypename = false;
        autoBind(this);
    }
    createNext(parentSchemaType, selectionSet) {
        return new SelectionSetToObject(this._processor, this._scalars, this._schema, this._convertName.bind(this), this._getFragmentSuffix.bind(this), this._loadedFragments, this._config, parentSchemaType, selectionSet);
    }
    /**
     * traverse the inline fragment nodes recursively for colleting the selectionSets on each type
     */
    _collectInlineFragments(parentType, nodes, types) {
        if (isListType(parentType) || isNonNullType(parentType)) {
            return this._collectInlineFragments(parentType.ofType, nodes, types);
        }
        else if (isObjectType(parentType)) {
            for (const node of nodes) {
                const typeOnSchema = node.typeCondition ? this._schema.getType(node.typeCondition.name.value) : parentType;
                const { fields, inlines, spreads } = separateSelectionSet(node.selectionSet.selections);
                const spreadsUsage = this.buildFragmentSpreadsUsage(spreads);
                if (isObjectType(typeOnSchema)) {
                    this._appendToTypeMap(types, typeOnSchema.name, fields);
                    this._appendToTypeMap(types, typeOnSchema.name, spreadsUsage[typeOnSchema.name]);
                    this._collectInlineFragments(typeOnSchema, inlines, types);
                }
                else if (isInterfaceType(typeOnSchema) && parentType.getInterfaces().includes(typeOnSchema)) {
                    this._appendToTypeMap(types, parentType.name, fields);
                    this._appendToTypeMap(types, parentType.name, spreadsUsage[parentType.name]);
                    this._collectInlineFragments(typeOnSchema, inlines, types);
                }
            }
        }
        else if (isInterfaceType(parentType)) {
            const possibleTypes = getPossibleTypes(this._schema, parentType);
            for (const node of nodes) {
                const schemaType = node.typeCondition ? this._schema.getType(node.typeCondition.name.value) : parentType;
                const { fields, inlines, spreads } = separateSelectionSet(node.selectionSet.selections);
                const spreadsUsage = this.buildFragmentSpreadsUsage(spreads);
                if (isObjectType(schemaType) && possibleTypes.find(possibleType => possibleType.name === schemaType.name)) {
                    this._appendToTypeMap(types, schemaType.name, fields);
                    this._appendToTypeMap(types, schemaType.name, spreadsUsage[schemaType.name]);
                    this._collectInlineFragments(schemaType, inlines, types);
                }
                else if (isInterfaceType(schemaType) && schemaType.name === parentType.name) {
                    for (const possibleType of possibleTypes) {
                        this._appendToTypeMap(types, possibleType.name, fields);
                        this._appendToTypeMap(types, possibleType.name, spreadsUsage[possibleType.name]);
                        this._collectInlineFragments(schemaType, inlines, types);
                    }
                }
                else {
                    for (const possibleType of possibleTypes) {
                        this._appendToTypeMap(types, possibleType.name, fields);
                        this._appendToTypeMap(types, possibleType.name, spreadsUsage[possibleType.name]);
                    }
                }
            }
        }
        else if (isUnionType(parentType)) {
            const possibleTypes = parentType.getTypes();
            for (const node of nodes) {
                const schemaType = node.typeCondition ? this._schema.getType(node.typeCondition.name.value) : parentType;
                const { fields, inlines, spreads } = separateSelectionSet(node.selectionSet.selections);
                const spreadsUsage = this.buildFragmentSpreadsUsage(spreads);
                if (isObjectType(schemaType) && possibleTypes.find(possibleType => possibleType.name === schemaType.name)) {
                    this._appendToTypeMap(types, schemaType.name, fields);
                    this._appendToTypeMap(types, schemaType.name, spreadsUsage[schemaType.name]);
                    this._collectInlineFragments(schemaType, inlines, types);
                }
                else if (isInterfaceType(schemaType)) {
                    const possibleInterfaceTypes = getPossibleTypes(this._schema, schemaType);
                    for (const possibleType of possibleTypes) {
                        if (possibleInterfaceTypes.find(possibleInterfaceType => possibleInterfaceType.name === possibleType.name)) {
                            this._appendToTypeMap(types, possibleType.name, fields);
                            this._appendToTypeMap(types, possibleType.name, spreadsUsage[possibleType.name]);
                            this._collectInlineFragments(schemaType, inlines, types);
                        }
                    }
                }
                else {
                    for (const possibleType of possibleTypes) {
                        this._appendToTypeMap(types, possibleType.name, fields);
                        this._appendToTypeMap(types, possibleType.name, spreadsUsage[possibleType.name]);
                    }
                }
            }
        }
    }
    _createInlineFragmentForFieldNodes(parentType, fieldNodes) {
        return {
            kind: Kind.INLINE_FRAGMENT,
            typeCondition: {
                kind: Kind.NAMED_TYPE,
                name: {
                    kind: Kind.NAME,
                    value: parentType.name,
                },
            },
            directives: [],
            selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: fieldNodes,
            },
        };
    }
    buildFragmentSpreadsUsage(spreads) {
        const selectionNodesByTypeName = {};
        for (const spread of spreads) {
            const fragmentSpreadObject = this._loadedFragments.find(lf => lf.name === spread.name.value);
            if (fragmentSpreadObject) {
                const schemaType = this._schema.getType(fragmentSpreadObject.onType);
                const possibleTypesForFragment = getPossibleTypes(this._schema, schemaType);
                for (const possibleType of possibleTypesForFragment) {
                    const fragmentSuffix = this._getFragmentSuffix(spread.name.value);
                    const usage = this.buildFragmentTypeName(spread.name.value, fragmentSuffix, possibleTypesForFragment.length === 1 ? null : possibleType.name);
                    if (!selectionNodesByTypeName[possibleType.name]) {
                        selectionNodesByTypeName[possibleType.name] = [];
                    }
                    selectionNodesByTypeName[possibleType.name].push(usage);
                }
            }
        }
        return selectionNodesByTypeName;
    }
    flattenSelectionSet(selections) {
        const selectionNodesByTypeName = new Map();
        const inlineFragmentSelections = [];
        const fieldNodes = [];
        const fragmentSpreads = [];
        for (const selection of selections) {
            switch (selection.kind) {
                case Kind.FIELD:
                    fieldNodes.push(selection);
                    break;
                case Kind.INLINE_FRAGMENT:
                    inlineFragmentSelections.push(selection);
                    break;
                case Kind.FRAGMENT_SPREAD:
                    fragmentSpreads.push(selection);
                    break;
            }
        }
        if (fieldNodes.length) {
            inlineFragmentSelections.push(this._createInlineFragmentForFieldNodes(this._parentSchemaType, fieldNodes));
        }
        this._collectInlineFragments(this._parentSchemaType, inlineFragmentSelections, selectionNodesByTypeName);
        const fragmentsUsage = this.buildFragmentSpreadsUsage(fragmentSpreads);
        Object.keys(fragmentsUsage).forEach(typeName => {
            this._appendToTypeMap(selectionNodesByTypeName, typeName, fragmentsUsage[typeName]);
        });
        return selectionNodesByTypeName;
    }
    _appendToTypeMap(types, typeName, nodes) {
        if (!types.has(typeName)) {
            types.set(typeName, []);
        }
        if (nodes && nodes.length > 0) {
            types.get(typeName).push(...nodes);
        }
    }
    _buildGroupedSelections() {
        if (!this._selectionSet || !this._selectionSet.selections || this._selectionSet.selections.length === 0) {
            return {};
        }
        const selectionNodesByTypeName = this.flattenSelectionSet(this._selectionSet.selections);
        const grouped = getPossibleTypes(this._schema, this._parentSchemaType).reduce((prev, type) => {
            const typeName = type.name;
            const schemaType = this._schema.getType(typeName);
            if (!isObjectType(schemaType)) {
                throw new TypeError(`Invalid state! Schema type ${typeName} is not a valid GraphQL object!`);
            }
            const selectionNodes = selectionNodesByTypeName.get(typeName) || [];
            if (!prev[typeName]) {
                prev[typeName] = [];
            }
            const transformedSet = this.buildSelectionSetString(schemaType, selectionNodes);
            if (transformedSet) {
                prev[typeName].push(transformedSet);
            }
            return prev;
        }, {});
        return grouped;
    }
    buildSelectionSetString(parentSchemaType, selectionNodes) {
        const primitiveFields = new Map();
        const primitiveAliasFields = new Map();
        const linkFieldSelectionSets = new Map();
        let requireTypename = false;
        const fragmentsSpreadUsages = [];
        for (const selectionNode of selectionNodes) {
            if (typeof selectionNode === 'string') {
                fragmentsSpreadUsages.push(selectionNode);
            }
            else if (selectionNode.kind === 'Field') {
                if (!selectionNode.selectionSet) {
                    if (selectionNode.alias) {
                        primitiveAliasFields.set(selectionNode.alias.value, selectionNode);
                    }
                    else if (selectionNode.name.value === '__typename') {
                        requireTypename = true;
                    }
                    else {
                        primitiveFields.set(selectionNode.name.value, selectionNode);
                    }
                }
                else {
                    let selectedField = null;
                    const fields = parentSchemaType.getFields();
                    selectedField = fields[selectionNode.name.value];
                    if (isMetadataFieldName(selectionNode.name.value)) {
                        selectedField = metadataFieldMap[selectionNode.name.value];
                    }
                    if (!selectedField) {
                        continue;
                    }
                    const fieldName = getFieldNodeNameValue(selectionNode);
                    let linkFieldNode = linkFieldSelectionSets.get(fieldName);
                    if (!linkFieldNode) {
                        linkFieldNode = {
                            selectedFieldType: selectedField.type,
                            field: selectionNode,
                        };
                        linkFieldSelectionSets.set(fieldName, linkFieldNode);
                    }
                    else {
                        mergeSelectionSets(linkFieldNode.field.selectionSet, selectionNode.selectionSet);
                    }
                }
            }
        }
        const linkFields = [];
        for (const { field, selectedFieldType } of linkFieldSelectionSets.values()) {
            const realSelectedFieldType = getBaseType(selectedFieldType);
            const selectionSet = this.createNext(realSelectedFieldType, field.selectionSet);
            linkFields.push({
                alias: field.alias ? this._processor.config.formatNamedField(field.alias.value, selectedFieldType) : undefined,
                name: this._processor.config.formatNamedField(field.name.value, selectedFieldType),
                type: realSelectedFieldType.name,
                selectionSet: this._processor.config.wrapTypeWithModifiers(selectionSet.transformSelectionSet().split(`\n`).join(`\n  `), selectedFieldType),
            });
        }
        const typeInfoField = this.buildTypeNameField(parentSchemaType, this._config.nonOptionalTypename, this._config.addTypename, requireTypename, this._config.skipTypeNameForRoot);
        const transformed = [
            ...(typeInfoField ? this._processor.transformTypenameField(typeInfoField.type, typeInfoField.name) : []),
            ...this._processor.transformPrimitiveFields(parentSchemaType, Array.from(primitiveFields.values()).map(field => field.name.value)),
            ...this._processor.transformAliasesPrimitiveFields(parentSchemaType, Array.from(primitiveAliasFields.values()).map(field => ({
                alias: field.alias.value,
                fieldName: field.name.value,
            }))),
            ...this._processor.transformLinkFields(linkFields),
        ].filter(Boolean);
        const allStrings = transformed.filter(t => typeof t === 'string');
        const allObjectsMerged = transformed
            .filter(t => typeof t !== 'string')
            .map((t) => `${t.name}: ${t.type}`);
        let mergedObjectsAsString = null;
        if (allObjectsMerged.length > 0) {
            mergedObjectsAsString = this._processor.buildFieldsIntoObject(allObjectsMerged);
        }
        const fields = [...allStrings, mergedObjectsAsString, ...fragmentsSpreadUsages].filter(Boolean);
        return this._processor.buildSelectionSetFromStrings(fields);
    }
    isRootType(type) {
        const rootType = [this._schema.getQueryType(), this._schema.getMutationType(), this._schema.getSubscriptionType()]
            .filter(Boolean)
            .map(t => t.name);
        return rootType.includes(type.name);
    }
    buildTypeNameField(type, nonOptionalTypename = this._config.nonOptionalTypename, addTypename = this._config.addTypename, queriedForTypename = this._queriedForTypename, skipTypeNameForRoot = this._config.skipTypeNameForRoot) {
        if (this.isRootType(type) && skipTypeNameForRoot && !queriedForTypename) {
            return null;
        }
        if (nonOptionalTypename || addTypename || queriedForTypename) {
            const optionalTypename = !queriedForTypename && !nonOptionalTypename;
            return {
                name: `${this._processor.config.formatNamedField('__typename')}${optionalTypename ? '?' : ''}`,
                type: `'${type.name}'`,
            };
        }
        return null;
    }
    transformSelectionSet() {
        const grouped = this._buildGroupedSelections();
        return Object.keys(grouped)
            .map(typeName => {
            const relevant = grouped[typeName].filter(Boolean);
            if (relevant.length === 0) {
                return null;
            }
            else if (relevant.length === 1) {
                return relevant[0];
            }
            else {
                return `( ${relevant.join(' & ')} )`;
            }
        })
            .filter(Boolean)
            .join(' | ');
    }
    transformFragmentSelectionSetToTypes(fragmentName, fragmentSuffix, declarationBlockConfig) {
        const grouped = this._buildGroupedSelections();
        const subTypes = Object.keys(grouped)
            .map(typeName => {
            const possibleFields = grouped[typeName].filter(Boolean);
            if (possibleFields.length === 0) {
                return null;
            }
            const declarationName = this.buildFragmentTypeName(fragmentName, fragmentSuffix, typeName);
            return { name: declarationName, content: possibleFields.join(' & ') };
        })
            .filter(Boolean);
        if (subTypes.length === 1) {
            return new DeclarationBlock(declarationBlockConfig)
                .export()
                .asKind('type')
                .withName(this.buildFragmentTypeName(fragmentName, fragmentSuffix))
                .withContent(subTypes[0].content).string;
        }
        return [
            ...subTypes.map(t => new DeclarationBlock(declarationBlockConfig)
                .export(this._config.exportFragmentSpreadSubTypes)
                .asKind('type')
                .withName(t.name)
                .withContent(t.content).string),
            new DeclarationBlock(declarationBlockConfig)
                .export()
                .asKind('type')
                .withName(this.buildFragmentTypeName(fragmentName, fragmentSuffix))
                .withContent(subTypes.map(t => t.name).join(' | ')).string,
        ].join('\n');
    }
    buildFragmentTypeName(name, suffix, typeName = '') {
        return this._convertName(name, {
            useTypesPrefix: true,
            suffix: typeName ? `_${typeName}_${suffix}` : suffix,
        });
    }
}
//# sourceMappingURL=selection-set-to-object.js.map