import { OperationVariablesToObject } from '@graphql-codegen/visitor-plugin-common';
import { Kind } from 'graphql';
export class FlowOperationVariablesToObject extends OperationVariablesToObject {
    clearOptional(str) {
        if (str.startsWith('?')) {
            return str.replace(/^\?(.*?)$/i, '$1');
        }
        return str;
    }
    getScalar(name) {
        const prefix = this._namespacedImportName ? `${this._namespacedImportName}.` : '';
        return `$ElementType<${prefix}Scalars, '${name}'>`;
    }
    wrapAstTypeWithModifiers(baseType, typeNode) {
        if (typeNode.kind === Kind.NON_NULL_TYPE) {
            const type = this.wrapAstTypeWithModifiers(baseType, typeNode.type);
            return this.clearOptional(type);
        }
        else if (typeNode.kind === Kind.LIST_TYPE) {
            const innerType = this.wrapAstTypeWithModifiers(baseType, typeNode.type);
            return `?Array<${innerType}>`;
        }
        else {
            return `?${baseType}`;
        }
    }
    formatFieldString(fieldName, isNonNullType, hasDefaultValue) {
        if (hasDefaultValue || isNonNullType) {
            return fieldName;
        }
        else {
            return `${fieldName}?`;
        }
    }
    formatTypeString(fieldType, isNonNullType, hasDefaultValue) {
        if (hasDefaultValue && !isNonNullType) {
            return this.clearOptional(fieldType);
        }
        return fieldType;
    }
}
//# sourceMappingURL=flow-variables-to-object.js.map