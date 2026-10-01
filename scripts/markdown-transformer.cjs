const transformer = require('@expo/metro-config/babel-transformer');

module.exports.transform = (args) => {
    if (!args.filename.endsWith('.md')) return transformer.transform(args);
    const source = args.src.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim();
    return transformer.transform({ ...args, src: `export default ${JSON.stringify(source)};` });
};
