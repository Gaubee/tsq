import { readFileSync } from 'fs';
import * as ts from 'typescript';
import { Console } from 'console-pro';
const console = new Console();

export function delint(sourceFile: ts.SourceFile) {
	delintNode(sourceFile);

	function delintNode(node: ts.Node) {
		// console.log(node);
		switch (node.kind) {
			case ts.SyntaxKind.Decorator: {
				const n = node as ts.Decorator;
				console.flag('修饰器', n.expression.getFirstToken().getText());
				break;
			}
			case ts.SyntaxKind.Constructor: {
				// const n = node as ts.ConstructorDeclaration;
				console.flag('构造函数', node.getFirstToken().getText());
				break;
			}
			// case ts.SyntaxKind.ForStatement:
			// case ts.SyntaxKind.ForInStatement:
			// case ts.SyntaxKind.WhileStatement:
			// case ts.SyntaxKind.DoStatement:
			//     if ((<ts.IterationStatement>node).statement.kind !== ts.SyntaxKind.Block) {
			//         report(node, "A looping statement's contents should be wrapped in a block body.");
			//     }
			//     break;

			// case ts.SyntaxKind.IfStatement:
			//     let ifStatement = (<ts.IfStatement>node);
			//     if (ifStatement.thenStatement.kind !== ts.SyntaxKind.Block) {
			//         report(ifStatement.thenStatement, "An if statement's contents should be wrapped in a block body.");
			//     }
			//     if (ifStatement.elseStatement &&
			//         ifStatement.elseStatement.kind !== ts.SyntaxKind.Block &&
			//         ifStatement.elseStatement.kind !== ts.SyntaxKind.IfStatement) {
			//         report(ifStatement.elseStatement, "An else statement's contents should be wrapped in a block body.");
			//     }
			//     break;

			// case ts.SyntaxKind.BinaryExpression:
			//     let op = (<ts.BinaryExpression>node).operatorToken.kind;
			//     if (op === ts.SyntaxKind.EqualsEqualsToken || op == ts.SyntaxKind.ExclamationEqualsToken) {
			//         report(node, "Use '===' and '!=='.")
			//     }
			//     break;
		}

		ts.forEachChild(node, delintNode);
	}

	function report(node: ts.Node, message: string) {
		let { line, character } = sourceFile.getLineAndCharacterOfPosition(
			node.getStart()
		);
		console.log(
			`${sourceFile.fileName} (${line + 1},${character + 1}): ${message}`
		);
	}
}

const fileNames = process.argv.slice(2);
fileNames.forEach(fileName => {
	// Parse a file
	let sourceFile = ts.createSourceFile(
		fileName,
		readFileSync(fileName).toString(),
		ts.ScriptTarget.ES2017,
		/*setParentNodes */ true
	);

	// delint it
	delint(sourceFile);
});
