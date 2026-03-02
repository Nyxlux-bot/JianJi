const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project();
project.addSourceFilesAtPaths(['src/components/**/*.tsx', 'app/**/*.tsx']);

project.getSourceFiles().forEach(sf => {
    const importDec = sf.getImportDeclaration(d => d.getModuleSpecifierValue().includes('colors'));
    if (!importDec) return;

    const hasColors = importDec.getNamedImports().some(n => n.getName() === 'Colors');
    if (!hasColors) return;

    console.log('Processing:', sf.getFilePath());

    // 1. Remove Colors import
    const namedImports = importDec.getNamedImports();
    if (namedImports.length === 1) {
        importDec.remove();
    } else {
        namedImports.find(n => n.getName() === 'Colors').remove();
    }

    // Add useTheme import
    let rel = path.relative(path.dirname(sf.getFilePath()), path.join(process.cwd(), 'src/theme/ThemeContext')).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;

    sf.addImportDeclaration({
        namedImports: ['useTheme'],
        moduleSpecifier: rel
    });

    // 2. Change StyleSheet.create to makeStyles
    const stylesVar = sf.getVariableStatement('styles');
    let hasStyles = false;
    if (stylesVar) {
        const init = stylesVar.getDeclarations()[0].getInitializer();
        if (init && init.getText().startsWith('StyleSheet.create')) {
            const text = init.getText();
            stylesVar.remove();
            sf.addVariableStatement({
                declarationKind: 'const',
                declarations: [{
                    name: 'makeStyles',
                    initializer: `(Colors: any) => ${text}`
                }]
            });
            hasStyles = true;
        }
    }

    // 3. Inject hooks into the component
    let comp = sf.getDefaultExportSymbol()?.getDeclarations()[0];
    if (!comp) {
        const funcs = sf.getFunctions().filter(f => f.isDefaultExport() || f.isExported());
        if (funcs.length) comp = funcs[0];
    }

    if (comp) {
        let body;
        if (comp.getKind() === SyntaxKind.FunctionDeclaration) {
            body = comp.getBody();
        } else if (comp.getKind() === SyntaxKind.VariableDeclaration) {
            const init = comp.getInitializer();
            if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                body = init.getBody();
            }
        }

        if (body && body.getKind() === SyntaxKind.Block) {
            if (hasStyles) {
                body.insertStatements(0, 'const { Colors } = useTheme();\n    const styles = makeStyles(Colors);');
            } else {
                body.insertStatements(0, 'const { Colors } = useTheme();');
            }
        }
    }
});

project.saveSync();
console.log('Refactoring finished!');
