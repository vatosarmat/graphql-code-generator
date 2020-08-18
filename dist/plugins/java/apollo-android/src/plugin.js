import { concatAST, visit, Kind } from 'graphql';
import { InputTypeVisitor } from './input-type-visitor';
import { OperationVisitor } from './operation-visitor';
import { FileType } from './file-type';
import { CustomTypeClassVisitor } from './custom-type-class';
export const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    let visitor;
    switch (config.fileType) {
        case FileType.FRAGMENT:
        case FileType.OPERATION: {
            visitor = new OperationVisitor(schema, config, allFragments);
            break;
        }
        case FileType.INPUT_TYPE: {
            visitor = new InputTypeVisitor(schema, config);
            break;
        }
        case FileType.CUSTOM_TYPES: {
            visitor = new CustomTypeClassVisitor(schema, config);
            break;
        }
    }
    if (!visitor) {
        return { content: '' };
    }
    const visitResult = visit(allAst, visitor);
    const additionalContent = visitor.additionalContent();
    const imports = visitor.getImports();
    return {
        prepend: [`package ${visitor.getPackage()};\n`, ...imports],
        content: '\n' + [...visitResult.definitions.filter(a => a && typeof a === 'string'), additionalContent].join('\n'),
    };
};
//# sourceMappingURL=plugin.js.map