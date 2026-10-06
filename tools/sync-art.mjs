import fs from 'node:fs';
const dir = 'public/art';
const paths = {};
if (fs.existsSync(dir))
  for (const file of fs.readdirSync(dir))
    if (file.endsWith('.png')) paths[file.slice(0, -4)] = '/art/' + file;
fs.writeFileSync(
  'src/data/artPaths.ts',
  'export const ART_PATHS:Record<string,string>=' + JSON.stringify(paths) + ';\n',
);
