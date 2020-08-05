const { exec } = require('child_process');
const path = require('path');

const cwd = path.join(__dirname, '..', 'wiki');

exec('tree -I images', { cwd }, (_, data) => {
  const structure =
    data
      .replace(/\\n/g, '\n')
      .replace(/│/g, ' ')
      .replace(/└──/g, '*')
      .replace(/├──/g, '*')
      .replace(/\* _.*\.md/g, '')
      .replace(/\b(.*).md/g, (__, file) => `[${file}](./${file.replace(/\s/g, '-')})`)
      .slice(2)
      .split('\n')
      .slice(0, -3)
      .map(line => line.replace(/\s{4}\*/g, '  *'))
      .join('\n');
  console.log(`### Directory\n\n${structure}`);
});
