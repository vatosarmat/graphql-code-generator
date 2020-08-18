import { Types } from '@graphql-codegen/plugin-helpers';
import { CompilerOptions } from 'typescript';
export declare function validateTs(
  pluginOutput: Types.PluginOutput,
  options?: CompilerOptions,
  isTsx?: boolean,
  isStrict?: boolean,
  openPlayground?: boolean
): void;
export declare function compileTs(
  contents: string,
  options?: CompilerOptions,
  isTsx?: boolean,
  openPlayground?: boolean
): void;
