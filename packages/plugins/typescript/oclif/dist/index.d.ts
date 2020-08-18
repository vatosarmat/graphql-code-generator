import { PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { RawClientSideBasePluginConfig } from '@graphql-codegen/visitor-plugin-common';
import { GraphQLRequestVisitor } from './visitor';
export interface Config extends RawClientSideBasePluginConfig {
  handlerPath?: string;
}
export interface Info {
  outputFile: string;
  allPlugins: any[];
}
export declare const plugin: PluginFunction;
export declare const validate: PluginValidateFn<any>;
export { GraphQLRequestVisitor };
