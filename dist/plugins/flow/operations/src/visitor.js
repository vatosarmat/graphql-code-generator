import { FlowWithPickSelectionSetProcessor } from './flow-selection-set-processor';
import { isEnumType, isNonNullType } from 'graphql';
import { FlowOperationVariablesToObject } from '@graphql-codegen/flow';
import { wrapTypeWithModifiers, PreResolveTypesProcessor, BaseDocumentsVisitor, SelectionSetToObject, getConfigValue, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
export class FlowDocumentsVisitor extends BaseDocumentsVisitor {
    constructor(schema, config, allFragments) {
        super(config, {
            useFlowExactObjects: getConfigValue(config.useFlowExactObjects, true),
            useFlowReadOnlyTypes: getConfigValue(config.useFlowReadOnlyTypes, false),
        }, schema);
        autoBind(this);
        const wrapArray = (type) => `Array<${type}>`;
        const wrapOptional = (type) => `?${type}`;
        const formatNamedField = (name, type) => {
            const optional = !!type && !isNonNullType(type);
            return `${name}${optional ? '?' : ''}`;
        };
        const processorConfig = {
            namespacedImportName: this.config.namespacedImportName,
            convertName: this.convertName.bind(this),
            enumPrefix: this.config.enumPrefix,
            scalars: this.scalars,
            formatNamedField,
            wrapTypeWithModifiers(baseType, type) {
                return wrapTypeWithModifiers(baseType, type, { wrapOptional, wrapArray });
            },
        };
        const processor = config.preResolveTypes
            ? new PreResolveTypesProcessor(processorConfig)
            : new FlowWithPickSelectionSetProcessor({
                ...processorConfig,
                useFlowExactObjects: this.config.useFlowExactObjects,
                useFlowReadOnlyTypes: this.config.useFlowReadOnlyTypes,
            });
        const enumsNames = Object.keys(schema.getTypeMap()).filter(typeName => isEnumType(schema.getType(typeName)));
        this.setSelectionSetHandler(new SelectionSetToObject(processor, this.scalars, this.schema, this.convertName.bind(this), this.getFragmentSuffix.bind(this), allFragments, this.config));
        this.setVariablesTransformer(new FlowOperationVariablesToObject(this.scalars, this.convertName.bind(this), this.config.namespacedImportName, enumsNames, this.config.enumPrefix));
    }
    getPunctuation(declarationKind) {
        return declarationKind === 'type' ? ',' : ';';
    }
}
//# sourceMappingURL=visitor.js.map