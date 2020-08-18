import { visit, concatAST, Kind, } from 'graphql';
import { join } from 'path';
import { FileType } from './file-type';
import { pascalCase } from 'pascal-case';
const packageNameToDirectory = (packageName) => {
    return `./${packageName.split('.').join('/')}/`;
};
export const preset = {
    buildGeneratesSection: options => {
        const outDir = options.baseOutputDir;
        const inputTypesAst = [];
        visit(options.schema, {
            enter: {
                InputObjectTypeDefinition(node) {
                    inputTypesAst.push(node);
                },
            },
        });
        const inputTypesDocumentNode = { kind: Kind.DOCUMENT, definitions: inputTypesAst };
        const allAst = concatAST(options.documents.map(v => v.document));
        const operationsAst = allAst.definitions.filter(d => d.kind === Kind.OPERATION_DEFINITION);
        const fragments = allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION);
        const externalFragments = fragments.map(frag => ({
            isExternal: true,
            importFrom: frag.name.value,
            name: frag.name.value,
            onType: frag.typeCondition.name.value,
            node: frag,
        }));
        return [
            {
                filename: join(outDir, packageNameToDirectory(options.config.typePackage), 'CustomType.java'),
                plugins: options.plugins,
                pluginMap: options.pluginMap,
                config: {
                    ...options.config,
                    fileType: FileType.CUSTOM_TYPES,
                },
                schema: options.schema,
                documents: [],
            },
            ...inputTypesDocumentNode.definitions.map((ast) => {
                return {
                    filename: join(outDir, packageNameToDirectory(options.config.typePackage), ast.name.value + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.INPUT_TYPE,
                        skipDocumentsValidation: true,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
            ...operationsAst.map((ast) => {
                const fileName = ast.name.value.toLowerCase().endsWith(ast.operation)
                    ? ast.name.value
                    : `${ast.name.value}${pascalCase(ast.operation)}`;
                return {
                    filename: join(outDir, packageNameToDirectory(options.config.package), fileName + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.OPERATION,
                        externalFragments,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
            ...fragments.map((ast) => {
                return {
                    filename: join(outDir, packageNameToDirectory(options.config.fragmentPackage), ast.name.value + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.FRAGMENT,
                        externalFragments,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
        ];
    },
};
//# sourceMappingURL=preset.js.map