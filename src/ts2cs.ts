import * as ts from 'typescript';
import nunjucks from "nunjucks";
import fs from "fs";
import {isPrimitive} from "util";

let declObjMap = new Map();
let declVarMap = new Map();

function retrieveObject(name: string) {
    let declObj = undefined;
    let declVar = declVarMap.get(name);
    if (declVar) {
        declVar = declVar.declarationList.declarations[0];
        if (declVar.type?.typeName) {
            declObj = declObjMap.get(declVar.type.typeName.escapedText);
        } else if (declVar.type?.members) {
            for (let member of declVar.type.members) {
                if (member.symbol.escapedName === "prototype") {
                    declObj = declObjMap.get(member.type.typeName.escapedText);
                }
            }
        }
    } else {
        declObj = declObjMap.get(name);
    }
    return declObj;
}

function visit(prefix: string) {
    return function(node: any) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableDeclaration: {
                ts.forEachChild(node, visit(prefix));
            }
                break;
            case ts.SyntaxKind.VariableStatement: {
                if (node.declarationList?.declarations) {
                    for (let decl of node.declarationList.declarations) {
                        declVarMap.set(decl.name.escapedText, node);
                    }
                }
            }
                break;
            case ts.SyntaxKind.ModuleDeclaration: {
                let moduleName = node.name.text;
                ts.forEachChild(node, visit(moduleName + "."));
            }
                break;
            case ts.SyntaxKind.ModuleBlock: {
                ts.forEachChild(node, visit(prefix));
            }
                break;
            case ts.SyntaxKind.TypeAliasDeclaration: {
                let typeAliasName = node.name.text;
                declObjMap.set(prefix + typeAliasName, node);
            }
                break;
            case ts.SyntaxKind.InterfaceDeclaration: {
                let interfaceName = node.name.text;
                declObjMap.set(prefix + interfaceName, node);
            }
                break;
            case ts.SyntaxKind.PropertySignature: {
                let propertyName = node.name;
                let propertyType = node.type;
                let arrayDeep = 0;
                let realPropertyName =
                    ('string' !== typeof propertyName && 'text' in propertyName)
                        ? propertyName.text
                        : propertyName;
                while (propertyType.kind === ts.SyntaxKind.ArrayType) {
                    arrayDeep++;
                    propertyType = propertyType.elementType;
                }
            }
                break;
            default:
                break;
        }
    };
}

function isPrimitiveType(type: any) {
    return type.typeName?.escapedText === "boolean" ||
           type.typeName?.escapedText === "number" ||
           type.typeName?.escapedText === "bigint" ||
           type.typeName?.escapedText === "string" ||
           type.typeName?.escapedText === "symbol";
}

function getNodeModifiers(propertyNode: any) {
    let isReadonly = false;
    let isRefType = false;
    if (propertyNode.modifiers) {
        for (let modifier of propertyNode.modifiers) {
            switch (modifier.kind) {
                case ts.SyntaxKind.ReadonlyKeyword: {
                    isReadonly = true;
                }
                    break;
            }
        }
        if (propertyNode.type) {
            isRefType = !isPrimitiveType(propertyNode.type);
        }
    }
    return {
        isReadonly,
        isRefType,
    };
}

function appendTypedPropertyToJson(context: any, json: any, propertyNode: any) {
    let propertyName = propertyNode.name;
    if (propertyName === undefined) {
        return;
    }

    let propertyType = propertyNode.type;
    let arrayDeep = 0;
    let realPropertyName =
        ('string' !== typeof propertyName && 'text' in propertyName)
            ? propertyName.text
            : propertyName;
    let realPropertyType;
    while (propertyType.kind === ts.SyntaxKind.ArrayType) {
        arrayDeep++;
        propertyType = propertyType.elementType;
    }
    if (propertyType.kind === ts.SyntaxKind.TypeReference) {
        let realPropertyType = propertyType.typeName;
        realPropertyType = 'List<'.repeat(arrayDeep) +
        (realPropertyType.kind === ts.SyntaxKind.QualifiedName
            ? realPropertyType.getText()
            : 'text' in realPropertyType
                ? realPropertyType.text
                : realPropertyType) +
        '>'.repeat(arrayDeep);
    } else {
        switch (propertyType.kind) {
            case ts.SyntaxKind.StringKeyword: {
                realPropertyType = "string";
            }
                break;
            case ts.SyntaxKind.NumberKeyword: {
                realPropertyType = "double";
            }
                break;
            case ts.SyntaxKind.BooleanKeyword: {
                realPropertyType = "bool";
            }
                break;
            case ts.SyntaxKind.VoidKeyword: {
                realPropertyType = "void";
            }
                break;
            case ts.SyntaxKind.AnyKeyword: {
                realPropertyType = "JSRuntimeObjectRef";
            }
                break;
            case ts.SyntaxKind.UnionType: {
                let isNull = false;
                realPropertyType = "";
                for (let type of propertyType.types) {
                    if (type.typeName !== undefined) {
                        realPropertyType += type.typeName.escapedText;
                    } else if (type.kind !== undefined) {
                        switch (type.kind) {
                            case ts.SyntaxKind.NullKeyword: {
                                isNull = true;
                            }
                                break;
                        }
                    }
                }
                if (isNull) {
                    realPropertyType += "?";
                }
            }
                break;
        }
    }
    if (realPropertyType === undefined) {
        if (propertyType.kind === ts.SyntaxKind.TypeReference) {
            realPropertyType = propertyType.typeName.getText();
            generate(context, realPropertyType);
        }
    }
    if (propertyNode.questionToken) {
        realPropertyType += "?";
    }
    let { isReadonly, isRefType } = getNodeModifiers(propertyNode);
    json[realPropertyName] = {
        type: realPropertyType,
        isReadonly: isReadonly,
        isRefType: isRefType,
        isMethod: propertyNode.kind === ts.SyntaxKind.MethodSignature,
    };
}

let isGenerating = false;
let nextToGenerate = new Array();

function generate(context: any, fullName: string | null) {
    while (fullName) {
        let tsNode = retrieveObject(fullName!);
        if (!tsNode) {
            if (nextToGenerate.length > 0) {
                fullName = nextToGenerate.shift();
                continue;
            } else {
                return;
            }
        }
        if (isGenerating) {
            nextToGenerate.push(fullName);
            return;
        }

        isGenerating = true;
        let namespaceName = '';
        let complexName = fullName.split(".");
        if (complexName.length > 1) {
            namespaceName = complexName.slice(0, complexName.length-1).join('.');
        }
        if (context.hasOwnProperty(fullName)) {
            return;
        }
        let extendedClasses;
        if (tsNode.heritageClauses) {
            for (const hr of tsNode.heritageClauses) {
                let regEx = /t(\$|\_|\w|\.)*/g;
                extendedClasses = hr.getText().split(" ").slice(1);
                extendedClasses.forEach(function(part: any, index: any, theArray: any) {
                    theArray[index] = theArray[index].replace(",", "");
                });
                for (let cls of extendedClasses) {
                    generate(context, cls);
                }
            }
        }

        let typedPropertiesJson = {};
        ts.forEachChild(tsNode, (node: any) => appendTypedPropertyToJson(context, typedPropertiesJson, node));
        let genObj = nunjucks.render(`BlazorBrowserObject.cs`, {
            objectNamespace: namespaceName,
            extendedClasses: extendedClasses,
            objectName: fullName,
            properties: typedPropertiesJson
        });
        console.log(`genObj is ${genObj}`);
        // @ts-ignore
        fs.writeFile(`./gen_dir/${fullName}.cs`, genObj, function (err: any, data: any) {
            if (err) {
                return console.error(`response: ./gen_dir/${fullName}.cs, err: ${err}`);
            }
        });
        context[fullName] = true;
        isGenerating = false;
        fullName = nextToGenerate.shift();
    }
}

export default function(filename: string, options: any) {
    const ROOT_PREFIX = '';

    let fileName = filename.slice(filename.lastIndexOf('/')+1);
    let program = ts.createProgram([filename], options);
    let checker = program.getTypeChecker();
    let sourceFiles = program.getSourceFiles();
    let domSourceFile: ts.SourceFile | null = null;
    let promiseSourceFile: ts.SourceFile | null = null;
    for (let file of sourceFiles) {
        let flName = file.fileName;
        let lastIndex = flName.lastIndexOf('/');
        let fl = flName.slice(lastIndex+1);
        if (fl === fileName) {
            domSourceFile = file;
            'lib.dom.d.ts'
        } else if (fl === 'lib.es2015.promise.d.ts') {
            promiseSourceFile = file;
        }
    }

    if (domSourceFile) {
        nunjucks.configure('templates', { autoescape: true });

        let context = {};
        ts.forEachChild(domSourceFile!, visit(ROOT_PREFIX));
        ts.forEachChild(promiseSourceFile!, visit(ROOT_PREFIX));
        generate(context, 'Promise')
        Object.assign({}, declObjMap);
    }
}
