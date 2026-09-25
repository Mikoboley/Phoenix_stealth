const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const failures = [];
for (const dir of ['core', 'commands']) {
  const directory = path.join(__dirname, dir);
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.js'))) {
    const full = path.join(directory, file);
    const syntax = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
    if (syntax.status !== 0) {
      failures.push(`${dir}/${file}: syntax error\n${syntax.stderr}`);
      continue;
    }
    try {
      require(full);
    } catch (error) {
      failures.push(`${dir}/${file}: load error (${error.code || error.name}) ${error.message}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Toutes les dépendances et tous les modules core/commands se chargent correctement.');
}
