import { BaseSelectionSetProcessor, indent, } from '@graphql-codegen/visitor-plugin-common';
export class FlowWithPickSelectionSetProcessor extends BaseSelectionSetProcessor {
    transformAliasesPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        return [
            `{${useFlowExactObject ? '|' : ''} ${fields
                .map(aliasedField => `${useFlowReadOnlyTypes ? '+' : ''}${aliasedField.alias}: $ElementType<${parentName}, '${aliasedField.fieldName}'>`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}`,
        ];
    }
    buildFieldsIntoObject(allObjectsMerged) {
        return `...{ ${allObjectsMerged.join(', ')} }`;
    }
    buildSelectionSetFromStrings(pieces) {
        if (pieces.length === 0) {
            return null;
        }
        else if (pieces.length === 1) {
            return pieces[0];
        }
        else {
            return `({\n  ${pieces.map(t => indent(`...${t}`)).join(`,\n`)}\n})`;
        }
    }
    transformLinkFields(fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        return [
            `{${useFlowExactObject ? '|' : ''} ${fields
                .map(field => `${useFlowReadOnlyTypes ? '+' : ''}${field.alias || field.name}: ${field.selectionSet}`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}`,
        ];
    }
    transformPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        const formatNamedField = this.config.formatNamedField;
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        const fieldObj = schemaType.getFields();
        return [
            `$Pick<${parentName}, {${useFlowExactObject ? '|' : ''} ${fields
                .map(fieldName => `${useFlowReadOnlyTypes ? '+' : ''}${formatNamedField(fieldName, fieldObj[fieldName].type)}: *`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}>`,
        ];
    }
    transformTypenameField(type, name) {
        return [`{ ${name}: ${type} }`];
    }
}
//# sourceMappingURL=flow-selection-set-processor.js.map