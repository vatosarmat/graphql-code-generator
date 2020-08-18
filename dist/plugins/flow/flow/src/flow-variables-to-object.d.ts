import { OperationVariablesToObject } from '@graphql-codegen/visitor-plugin-common';
import { TypeNode } from 'graphql';
export declare class FlowOperationVariablesToObject extends OperationVariablesToObject {
  private clearOptional;
  protected getScalar(name: string): string;
  wrapAstTypeWithModifiers(baseType: string, typeNode: TypeNode): string;
  protected formatFieldString(fieldName: string, isNonNullType: boolean, hasDefaultValue: boolean): string;
  protected formatTypeString(fieldType: string, isNonNullType: boolean, hasDefaultValue: boolean): string;
}
