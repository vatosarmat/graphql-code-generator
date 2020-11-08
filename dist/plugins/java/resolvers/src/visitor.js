import { BaseVisitor, transformMappers, parseMapper, indent, indentMultiline, getBaseTypeNode, buildScalars, } from '@graphql-codegen/visitor-plugin-common';
import { JAVA_SCALARS, JavaDeclarationBlock, wrapTypeWithModifiers } from '@graphql-codegen/java-common';
export class JavaResolversVisitor extends BaseVisitor {
    constructor(rawConfig, _schema, defaultPackageName) {
        super(rawConfig, {
            mappers: transformMappers(rawConfig.mappers || {}),
            package: rawConfig.package || defaultPackageName,
            defaultMapper: parseMapper(rawConfig.defaultMapper || 'Object'),
            className: rawConfig.className || 'Resolvers',
            listType: rawConfig.listType || 'Iterable',
            scalars: buildScalars(_schema, rawConfig.scalars, JAVA_SCALARS, 'Object'),
        });
        this._includeTypeResolverImport = false;
    }
    getImports() {
        const mappersImports = this.mappersImports();
        const allImports = [...mappersImports];
        if (this._includeTypeResolverImport) {
            allImports.push('graphql.schema.TypeResolver');
        }
        allImports.push('graphql.schema.DataFetcher');
        return allImports.map(i => `import ${i};`).join('\n') + '\n';
    }
    mappersImports() {
        return Object.keys(this.config.mappers)
            .map(typeName => this.config.mappers[typeName])
            .filter((m) => m.isExternal)
            .map(m => m.source);
    }
    getTypeToUse(type) {
        if (this.scalars[type.name.value]) {
            return this.scalars[type.name.value];
        }
        else if (this.config.mappers[type.name.value]) {
            return this.config.mappers[type.name.value].type;
        }
        return this.config.defaultMapper.type;
    }
    getPackageName() {
        return `package ${this.config.package};\n`;
    }
    wrapWithClass(content) {
        return new JavaDeclarationBlock()
            .access('public')
            .asKind('class')
            .withName(this.config.className)
            .withBlock(indentMultiline(content)).string;
    }
    UnionTypeDefinition(node) {
        this._includeTypeResolverImport = true;
        return new JavaDeclarationBlock()
            .access('public')
            .asKind('interface')
            .withName(this.convertName(node.name))
            .extends(['TypeResolver'])
            .withComment(node.description).string;
    }
    InterfaceTypeDefinition(node) {
        this._includeTypeResolverImport = true;
        return new JavaDeclarationBlock()
            .access('public')
            .asKind('interface')
            .withName(this.convertName(node.name))
            .extends(['TypeResolver'])
            .withComment(node.description)
            .withBlock(node.fields.map(f => indent(f(true))).join('\n')).string;
    }
    ObjectTypeDefinition(node) {
        return new JavaDeclarationBlock()
            .access('public')
            .asKind('interface')
            .withName(this.convertName(node.name))
            .withComment(node.description)
            .withBlock(node.fields.map(f => indent(f(false))).join('\n')).string;
    }
    FieldDefinition(node, key, _parent) {
        return (isInterface) => {
            const baseType = getBaseTypeNode(node.type);
            const typeToUse = this.getTypeToUse(baseType);
            const wrappedType = wrapTypeWithModifiers(typeToUse, node.type, this.config.listType);
            if (isInterface) {
                return `default public DataFetcher<${wrappedType}> ${node.name.value}() { return null; }`;
            }
            else {
                return `public DataFetcher<${wrappedType}> ${node.name.value}();`;
            }
        };
    }
}
//# sourceMappingURL=visitor.js.map