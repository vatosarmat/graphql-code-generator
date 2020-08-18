import { BaseSelectionSetProcessor, } from '@graphql-codegen/visitor-plugin-common';
export class TypeScriptSelectionSetProcessor extends BaseSelectionSetProcessor {
    transformPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        return [`Pick<${parentName}, ${fields.map(field => `'${field}'`).join(' | ')}>`];
    }
    transformTypenameField(type, name) {
        return [`{ ${name}: ${type} }`];
    }
    transformAliasesPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        return [
            `{ ${fields
                .map(aliasedField => {
                const value = aliasedField.fieldName === '__typename'
                    ? `'${schemaType.name}'`
                    : `${parentName}['${aliasedField.fieldName}']`;
                return `${aliasedField.alias}: ${value}`;
            })
                .join(', ')} }`,
        ];
    }
    transformLinkFields(fields) {
        if (fields.length === 0) {
            return [];
        }
        return [`{ ${fields.map(field => `${field.alias || field.name}: ${field.selectionSet}`).join(', ')} }`];
    }
}
//# sourceMappingURL=ts-selection-set-processor.js.map