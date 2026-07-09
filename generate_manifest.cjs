const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'public', 'DOCUMENTATION S DOUANE');
const outputFile = path.join(__dirname, 'public', 'manifest_docs.json');

function walkDir(dir) {
    const results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        if (file === '.DS_Store') return;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(path.join(__dirname, 'public'), filePath);
        
        if (stat && stat.isDirectory()) {
            results.push({
                name: file,
                type: 'directory',
                path: relativePath,
                children: walkDir(filePath)
            });
        } else {
            results.push({
                name: file,
                type: 'file',
                path: relativePath,
                url: '/' + relativePath.replace(/\\/g, '/'), // for web access
                size: stat.size
            });
        }
    });
    
    return results;
}

try {
    const tree = walkDir(targetDir);
    fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2));
    console.log('Manifest generated successfully with ' + tree.length + ' root items.');
} catch (e) {
    console.error('Error generating manifest:', e);
}
