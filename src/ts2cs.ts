import * as ts from 'typescript';
import nunjucks from "nunjucks";
import fs from "fs";

let declObjectMap = new Map();
let complexObjectMap = new Map();

function visit(prefix: string) {
    return function(node: any) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableDeclaration: {
                ts.forEachChild(node, visit(prefix));
                Symbol.isConcatSpreadable
            }
                break;
            case ts.SyntaxKind.VariableStatement: {
                if (node.declarationList?.declarations) {
                    for (let decl of node.declarationList.declarations) {
                        declObjectMap.set(decl.name.escapedText, node);
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
            case ts.SyntaxKind.InterfaceDeclaration: {
                let interfaceName = node.name.text;
                complexObjectMap.set(prefix + interfaceName, node);
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
                // if (propertyType.kind === ts.SyntaxKind.TypeReference) {
                //     let realPropertyType = propertyType.typeName;
                //     parent.addChildren(
                //         realPropertyName,
                //         'Array<'.repeat(arrayDeep) +
                //         (realPropertyType.kind === ts.SyntaxKind.QualifiedName
                //             ? realPropertyType.getText()
                //             : 'text' in realPropertyType
                //                 ? realPropertyType.text
                //                 : realPropertyType) +
                //         '>'.repeat(arrayDeep)
                //     );
                // } else {
                //     parent.addChildren(realPropertyName, propertyType.kind);
                // }
            }
                break;
            default:
                break;
        }
    };
}

function getNodeModifiers(propertyNode: any) {
    let isReadonly = false;
    if (propertyNode.modifiers) {
        for (let modifier of propertyNode.modifiers) {
            switch (modifier.kind) {
                case ts.SyntaxKind.ReadonlyKeyword: {
                    isReadonly = true;
                }
                    break;
            }
        }
    }
    return {
        isReadonly
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
        realPropertyType = 'Array<'.repeat(arrayDeep) +
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
            generate(context, realPropertyType, complexObjectMap.get(realPropertyType));
        }
    }
    if (propertyNode.questionToken) {
        realPropertyType += "?";
    }
    let { isReadonly } = getNodeModifiers(propertyNode);
    json[realPropertyName] = {
        type: realPropertyType,
        isReadonly: isReadonly,
        isMethod: propertyNode.kind === ts.SyntaxKind.MethodSignature,
    };
}

function generate(context: any, fullName: string, tsNode: any) {
    let objectName = tsNode.name.escapedText;
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
                generate(context, cls, complexObjectMap.get(cls));
            }
        }
    }

    let typedPropertiesJson = {};
    ts.forEachChild(tsNode, (node: any) => appendTypedPropertyToJson(context, typedPropertiesJson, node));
    let genObj = nunjucks.render(`BlazorBrowserObject.cs`, {
        objectNamespace: namespaceName,
        extendedClasses: extendedClasses,
        objectName: objectName,
        properties: typedPropertiesJson
    });
    console.log(`genObj is ${genObj}`);
    // @ts-ignore
    fs.writeFile(`./gen_dir/${objectName}.cs`, genObj, function (err: any, data: any) {
        if (err) {
            return console.log(err);
        }
        console.log(data);
    });
    context[fullName] = true;
}

export default function(filename: string, options: any) {
    const ROOT_PREFIX = '';

    let fileName = filename.slice(filename.lastIndexOf('/')+1);
    let program = ts.createProgram([filename], options);
    let checker = program.getTypeChecker();
    let sourceFiles = program.getSourceFiles();
    let sourceFile: ts.SourceFile | null = null;
    for (let file of sourceFiles) {
        let flName = file.fileName;
        let lastIndex = flName.lastIndexOf('/');
        let fl = flName.slice(lastIndex+1);
        if (fl === fileName) {
            sourceFile = file;
            break;
        }
    }

    if (sourceFile) {
        nunjucks.configure('templates', { autoescape: true });

        let context = {};
        ts.forEachChild(sourceFile, visit(ROOT_PREFIX));
        generate(context, 'GamepadPose', complexObjectMap.get('GamepadPose'))
        Object.assign({}, complexObjectMap);
    }
}
