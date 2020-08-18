import { Types, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { FlowPluginConfig } from './config';
export * from './visitor';
export * from './flow-variables-to-object';
export declare const plugin: PluginFunction<FlowPluginConfig, Types.ComplexPluginOutput>;
