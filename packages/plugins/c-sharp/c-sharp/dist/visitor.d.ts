import { ParsedConfig, BaseVisitor, EnumValuesMap } from '@graphql-codegen/visitor-plugin-common';
import { CSharpResolversPluginRawConfig } from './config';
import {
  GraphQLSchema,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
  DirectiveNode,
  StringValueNode,
  NamedTypeNode,
} from 'graphql';
import { CSharpFieldType } from '../../common/common';
export interface CSharpResolverParsedConfig extends ParsedConfig {
  namespaceName: string;
  className: string;
  listType: string;
  enumValues: EnumValuesMap;
}
export declare class CSharpResolversVisitor extends BaseVisitor<
  CSharpResolversPluginRawConfig,
  CSharpResolverParsedConfig
> {
  private _schema;
  private readonly keywords;
  constructor(rawConfig: CSharpResolversPluginRawConfig, _schema: GraphQLSchema);
  /**
   * Checks name against list of keywords. If it is, will prefix value with @
   *
   * Note:
   * This class should first invoke the convertName from base-visitor to convert the string or node
   * value according the naming configuration, eg upper or lower case. Then resulting string checked
   * against the list or keywords.
   * However the generated C# code is not yet able to handle fields that are in a different case so
   * the invocation of convertName is omitted purposely.
   */
  private convertSafeName;
  getImports(): string;
  wrapWithNamespace(content: string): string;
  wrapWithClass(content: string): string;
  protected getEnumValue(enumName: string, enumOption: string): string;
  EnumValueDefinition(node: EnumValueDefinitionNode): (enumName: string) => string;
  EnumTypeDefinition(node: EnumTypeDefinitionNode): string;
  getFieldHeader(
    node: InputValueDefinitionNode | FieldDefinitionNode | EnumValueDefinitionNode,
    fieldType?: CSharpFieldType
  ): string;
  getDeprecationReason(directive: DirectiveNode): string;
  protected resolveInputFieldType(typeNode: TypeNode, hasDefaultValue?: Boolean): CSharpFieldType;
  protected buildClass(
    name: string,
    description: StringValueNode,
    inputValueArray: ReadonlyArray<FieldDefinitionNode>,
    interfaces?: ReadonlyArray<NamedTypeNode>
  ): string;
  protected buildInterface(
    name: string,
    description: StringValueNode,
    inputValueArray: ReadonlyArray<FieldDefinitionNode>
  ): string;
  protected buildInputTransformer(
    name: string,
    description: StringValueNode,
    inputValueArray: ReadonlyArray<InputValueDefinitionNode>
  ): string;
  InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): string;
  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string;
  InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode): string;
}
