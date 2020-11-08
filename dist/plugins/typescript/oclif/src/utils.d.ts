import { OperationDefinitionNode, VariableDefinitionNode } from 'graphql';
export declare const getFlagConfigForVariableDefinition: (definition: VariableDefinitionNode) => string;
export declare const omitOclifDirectives: (
  node: OperationDefinitionNode
) => OperationDefinitionNode & {
  directives: import('graphql').DirectiveNode[];
};
