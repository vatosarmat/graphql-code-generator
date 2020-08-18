import { Types, PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { VueApolloVisitor } from './visitor';
import { VueApolloRawPluginConfig } from './config';
export declare const plugin: PluginFunction<VueApolloRawPluginConfig, Types.ComplexPluginOutput>;
export declare const validate: PluginValidateFn<any>;
export { VueApolloVisitor };
