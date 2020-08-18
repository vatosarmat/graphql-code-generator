import * as TJS from 'typescript-json-schema';
import { PluginConfig } from './plugins';
export declare function generateDocs(schema: TJS.Definition, types: PluginConfig[]): Record<string, string>;
