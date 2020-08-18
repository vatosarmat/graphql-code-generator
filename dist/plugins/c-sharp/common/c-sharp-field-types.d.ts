export interface BaseTypeField {
  type: string;
  valueType: boolean;
  required: boolean;
}
export interface ListTypeField {
  required: boolean;
  type: ListTypeField;
}
export interface CSharpField {
  baseType: BaseTypeField;
  listType?: ListTypeField;
}
export declare class CSharpFieldType implements CSharpField {
  baseType: BaseTypeField;
  listType?: ListTypeField;
  constructor(fieldType: CSharpField);
  get innerTypeName(): string;
  get isOuterTypeRequired(): boolean;
}
