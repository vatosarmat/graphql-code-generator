import { TypeNode, StringValueNode } from 'graphql';
import { ListTypeField, CSharpFieldType } from './c-sharp-field-types';
export declare function transformComment(comment: string | StringValueNode, indentLevel?: number): string;
export declare function isValueType(type: string): boolean;
export declare function getListTypeField(typeNode: TypeNode): ListTypeField | undefined;
export declare function getListTypeDepth(listType: ListTypeField): number;
export declare function getListInnerTypeNode(typeNode: TypeNode): TypeNode;
export declare function wrapFieldType(
  fieldType: CSharpFieldType,
  listTypeField?: ListTypeField,
  listType?: string
): string;
