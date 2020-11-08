import { getBaseTypeNode, indent, indentMultiline } from '@graphql-codegen/visitor-plugin-common';
import { JavaDeclarationBlock } from '@graphql-codegen/java-common';
import { isScalarType, isInputObjectType, Kind, isEnumType, } from 'graphql';
import { Imports } from './imports';
import { BaseJavaVisitor, SCALAR_TO_WRITER_METHOD } from './base-java-visitor';
export class InputTypeVisitor extends BaseJavaVisitor {
    constructor(_schema, rawConfig) {
        super(_schema, rawConfig, {
            typePackage: rawConfig.typePackage || 'type',
        });
    }
    getPackage() {
        return this.config.typePackage;
    }
    addInputMembers(cls, fields) {
        fields.forEach(field => {
            const type = this.transformType(field.type);
            const actualType = type.isNonNull ? type.typeToUse : `Input<${type.typeToUse}>`;
            const annotations = type.isNonNull ? [type.annotation] : [];
            this._imports.add(Imports[type.annotation]);
            cls.addClassMember(field.name.value, actualType, null, annotations, 'private', { final: true });
            cls.addClassMethod(field.name.value, actualType, `return this.${field.name.value};`, [], [type.annotation], 'public');
        });
    }
    addInputCtor(cls, className, fields) {
        const impl = fields.map(field => `this.${field.name.value} = ${field.name.value};`).join('\n');
        cls.addClassMethod(className, null, impl, fields.map(f => {
            const type = this.transformType(f.type);
            const actualType = type.isNonNull ? type.typeToUse : `Input<${type.typeToUse}>`;
            this._imports.add(Imports[type.annotation]);
            return {
                name: f.name.value,
                type: actualType,
                annotations: type.isNonNull ? [type.annotation] : [],
            };
        }), [], 'public');
    }
    getFieldWriterCall(field, listItemCall = false) {
        const baseType = getBaseTypeNode(field.type);
        const schemaType = this._schema.getType(baseType.name.value);
        const isNonNull = field.type.kind === Kind.NON_NULL_TYPE;
        let writerMethod = null;
        if (isScalarType(schemaType)) {
            writerMethod = SCALAR_TO_WRITER_METHOD[schemaType.name] || 'writeCustom';
        }
        else if (isInputObjectType(schemaType)) {
            return listItemCall
                ? `writeObject($item.marshaller())`
                : `writeObject("${field.name.value}", ${field.name.value}.value != null ? ${field.name.value}.value.marshaller() : null)`;
        }
        else if (isEnumType(schemaType)) {
            writerMethod = 'writeString';
        }
        return listItemCall
            ? `${writerMethod}($item)`
            : `${writerMethod}("${field.name.value}", ${field.name.value}${isNonNull ? '' : '.value'})`;
    }
    getFieldWithTypePrefix(field, wrapWith = null, applyNullable = false) {
        this._imports.add(Imports.Input);
        const typeToUse = this.getJavaClass(this._schema.getType(getBaseTypeNode(field.type).name.value));
        const isNonNull = field.type.kind === Kind.NON_NULL_TYPE;
        const name = field.kind === Kind.INPUT_VALUE_DEFINITION ? field.name.value : field.variable.name.value;
        if (isNonNull) {
            this._imports.add(Imports.Nonnull);
            return `@Nonnull ${typeToUse} ${name}`;
        }
        else {
            if (wrapWith) {
                return typeof wrapWith === 'function' ? `${wrapWith(typeToUse)} ${name}` : `${wrapWith}<${typeToUse}> ${name}`;
            }
            else {
                if (applyNullable) {
                    this._imports.add(Imports.Nullable);
                }
                return `${applyNullable ? '@Nullable ' : ''}${typeToUse} ${name}`;
            }
        }
    }
    buildFieldsMarshaller(field) {
        const isNonNull = field.type.kind === Kind.NON_NULL_TYPE;
        const isArray = field.type.kind === Kind.LIST_TYPE ||
            (field.type.kind === Kind.NON_NULL_TYPE && field.type.type.kind === Kind.LIST_TYPE);
        const call = this.getFieldWriterCall(field, isArray);
        const baseTypeNode = getBaseTypeNode(field.type);
        const listItemType = this.getJavaClass(this._schema.getType(baseTypeNode.name.value));
        let result = '';
        // TODO: Refactor
        if (isArray) {
            result = `writer.writeList("${field.name.value}", ${field.name.value}.value != null ? new InputFieldWriter.ListWriter() {
  @Override
  public void write(InputFieldWriter.ListItemWriter listItemWriter) throws IOException {
    for (${listItemType} $item : ${field.name.value}.value) {
      listItemWriter.${call};
    }
  }
} : null);`;
        }
        else {
            result = indent(`writer.${call};`);
        }
        if (isNonNull) {
            return result;
        }
        else {
            return indentMultiline(`if(${field.name.value}.defined) {
${indentMultiline(result)}
}`);
        }
    }
    buildMarshallerOverride(fields) {
        this._imports.add(Imports.Override);
        this._imports.add(Imports.IOException);
        this._imports.add(Imports.InputFieldWriter);
        this._imports.add(Imports.InputFieldMarshaller);
        const allMarshallers = fields.map(field => indentMultiline(this.buildFieldsMarshaller(field), 2));
        return indentMultiline(`@Override
public InputFieldMarshaller marshaller() {
  return new InputFieldMarshaller() {
    @Override
    public void marshal(InputFieldWriter writer) throws IOException {
${allMarshallers.join('\n')}
    }
  };
}`);
    }
    buildBuilderNestedClass(className, fields) {
        const builderClassName = 'Builder';
        const privateFields = fields
            .map(field => {
            const isArray = field.type.kind === Kind.LIST_TYPE ||
                (field.type.kind === Kind.NON_NULL_TYPE && field.type.type.kind === Kind.LIST_TYPE);
            const fieldType = this.getFieldWithTypePrefix(field, v => (!isArray ? `Input<${v}>` : `Input<List<${v}>>`));
            const isNonNull = field.type.kind === Kind.NON_NULL_TYPE;
            return `private ${fieldType}${isNonNull ? '' : ' = Input.absent()'};`;
        })
            .map(s => indent(s));
        const setters = fields
            .map(field => {
            const isArray = field.type.kind === Kind.LIST_TYPE ||
                (field.type.kind === Kind.NON_NULL_TYPE && field.type.type.kind === Kind.LIST_TYPE);
            const fieldType = this.getFieldWithTypePrefix(field, isArray ? 'List' : null);
            const isNonNull = field.type.kind === Kind.NON_NULL_TYPE;
            return `\npublic ${builderClassName} ${field.name.value}(${isNonNull ? '' : '@Nullable '}${fieldType}) {
  this.${field.name.value} = ${isNonNull ? field.name.value : `Input.fromNullable(${field.name.value})`};
  return this;
}`;
        })
            .map(s => indentMultiline(s));
        const nonNullFields = fields
            .filter(f => f.type.kind === Kind.NON_NULL_TYPE)
            .map(nnField => {
            this._imports.add(Imports.Utils);
            return indent(`Utils.checkNotNull(${nnField.name.value}, "${nnField.name.value} == null");`, 1);
        });
        const ctor = '\n' + indent(`${builderClassName}() {}`);
        const buildFn = indentMultiline(`public ${className} build() {
${nonNullFields.join('\n')}
  return new ${className}(${fields.map(f => f.name.value).join(', ')});
}`);
        const body = [...privateFields, ctor, ...setters, '', buildFn].join('\n');
        return indentMultiline(new JavaDeclarationBlock()
            .withName(builderClassName)
            .access('public')
            .final()
            .static()
            .withBlock(body)
            .asKind('class').string);
    }
    InputObjectTypeDefinition(node) {
        const className = node.name.value;
        this._imports.add(Imports.InputType);
        this._imports.add(Imports.Generated);
        const cls = new JavaDeclarationBlock()
            .annotate([`Generated("Apollo GraphQL")`])
            .access('public')
            .final()
            .asKind('class')
            .withName(className)
            .implements(['InputType']);
        this.addInputMembers(cls, node.fields);
        this.addInputCtor(cls, className, node.fields);
        cls.addClassMethod('builder', 'Builder', 'return new Builder();', [], [], 'public', { static: true });
        const marshallerOverride = this.buildMarshallerOverride(node.fields);
        const builderClass = this.buildBuilderNestedClass(className, node.fields);
        const classBlock = [marshallerOverride, '', builderClass].join('\n');
        cls.withBlock(classBlock);
        return cls.string;
    }
}
//# sourceMappingURL=input-type-visitor.js.map