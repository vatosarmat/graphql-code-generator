import { BaseSelectionSetProcessor, } from './base';
import { isEnumType } from 'graphql';
import { getBaseType } from '@graphql-codegen/plugin-helpers';
export class PreResolveTypesProcessor extends BaseSelectionSetProcessor {
    transformTypenameField(type, name) {
        return [
            {
                type,
                name,
            },
        ];
    }
    transformPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        return fields.map(field => {
            const fieldObj = schemaType.getFields()[field];
            const baseType = getBaseType(fieldObj.type);
            let typeToUse = baseType.name;
            if (isEnumType(baseType)) {
                typeToUse =
                    (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
                        this.config.convertName(baseType.name, { useTypesPrefix: this.config.enumPrefix });
            }
            else if (this.config.scalars[baseType.name]) {
                typeToUse = this.config.scalars[baseType.name];
            }
            const name = this.config.formatNamedField(field, fieldObj.type);
            const wrappedType = this.config.wrapTypeWithModifiers(typeToUse, fieldObj.type);
            return {
                name,
                type: wrappedType,
            };
        });
    }
    transformAliasesPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        return fields.map(aliasedField => {
            if (aliasedField.fieldName === '__typename') {
                const name = this.config.formatNamedField(aliasedField.alias, null);
                return {
                    name,
                    type: `'${schemaType.name}'`,
                };
            }
            else {
                const fieldObj = schemaType.getFields()[aliasedField.fieldName];
                const baseType = getBaseType(fieldObj.type);
                let typeToUse = this.config.scalars[baseType.name] || baseType.name;
                if (isEnumType(baseType)) {
                    typeToUse =
                        (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
                            this.config.convertName(baseType.name, { useTypesPrefix: this.config.enumPrefix });
                }
                const name = this.config.formatNamedField(aliasedField.alias, fieldObj.type);
                const wrappedType = this.config.wrapTypeWithModifiers(typeToUse, fieldObj.type);
                return {
                    name,
                    type: wrappedType,
                };
            }
        });
    }
    transformLinkFields(fields) {
        if (fields.length === 0) {
            return [];
        }
        return fields.map(field => ({
            name: field.alias || field.name,
            type: field.selectionSet,
        }));
    }
}
//# sourceMappingURL=pre-resolve-types.js.map