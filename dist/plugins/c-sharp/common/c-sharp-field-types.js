export class CSharpFieldType {
    constructor(fieldType) {
        Object.assign(this, fieldType);
    }
    get innerTypeName() {
        const nullable = this.baseType.valueType && !this.baseType.required ? '?' : '';
        return `${this.baseType.type}${nullable}`;
    }
    get isOuterTypeRequired() {
        return this.listType ? this.listType.required : this.baseType.required;
    }
}
//# sourceMappingURL=c-sharp-field-types.js.map