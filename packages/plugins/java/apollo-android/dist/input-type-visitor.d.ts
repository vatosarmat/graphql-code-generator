import { JavaApolloAndroidPluginConfig } from './plugin';
import {
  InputObjectTypeDefinitionNode,
  GraphQLSchema,
  InputValueDefinitionNode,
  VariableDefinitionNode,
} from 'graphql';
import { BaseJavaVisitor } from './base-java-visitor';
import { VisitorConfig } from './visitor-config';
export declare class InputTypeVisitor extends BaseJavaVisitor<VisitorConfig> {
  constructor(_schema: GraphQLSchema, rawConfig: JavaApolloAndroidPluginConfig);
  getPackage(): string;
  private addInputMembers;
  private addInputCtor;
  private getFieldWriterCall;
  protected getFieldWithTypePrefix(
    field: InputValueDefinitionNode | VariableDefinitionNode,
    wrapWith?: ((s: string) => string) | string | null,
    applyNullable?: boolean
  ): string;
  private buildFieldsMarshaller;
  private buildMarshallerOverride;
  private buildBuilderNestedClass;
  InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): string;
}
