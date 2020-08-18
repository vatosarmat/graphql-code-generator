import { PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { StencilApolloVisitor } from './visitor';
import { StencilApolloRawPluginConfig } from './config';
export declare const plugin: PluginFunction<StencilApolloRawPluginConfig>;
export declare const validate: PluginValidateFn<any>;
export { StencilApolloVisitor };
