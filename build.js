import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import shell from 'shelljs';
import * as dotenv from 'dotenv'

const argv = yargs(hideBin(process.argv)).argv;
const projectName = argv.projectName;
const homeDir = argv.homeDir;
const config = dotenv.config({ path: path.join(homeDir, `${projectName}.env`) })

const ecosystem = `module.exports = ${JSON.stringify({
  apps: [
    {
      name: projectName,
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env_production: config.parsed,
    }
  ]
})}`

shell.mkdir('~/next-turnip-pool');
shell.cd('~/next-turnip-pool');
try {
  shell.rm('-rf', `${projectName}*`)
  console.log(`Successfully Removed ${projectName}s`)
} catch (err) {
  console.log(`failed to remove ${projectName}`);
  console.error(err);
}

try {
  let output = shell.exec(`git clone https://github.com/Phonedolly/next-turnip ${projectName}_${argv.buildStartTime}`);
  process.send(output.toString());
  process.send('cd project directory');
  shell.cd(`${projectName}_${argv.buildStartTime}`);
  process.send('run npm ci')
  process.send(shell.exec(`npm ci`).toString());
  process.send('start build...');
  process.send(shell.exec(`REMOTE_PATTERNS_URLS=${config.parsed.REMOTE_PATTERNS_URLS} npm run build`).toString());
  process.send('prepare pm2 service');
  process.send(shell.exec(`pm2 delete ${projectName}`).toString());
  // shell.cp(path.join(homeDir, `${projectName}.ecosystem.config.js`), `./ecosystem.config.js`)
  fs.writeFileSync(path.join(homeDir, `ecosystem.config.js.tmp`), ecosystem)
  shell.mv(path.join(homeDir, `ecosystem.config.js.tmp`), './ecosystem.config.js')
  process.send(shell.exec(`pm2 start ecosystem.config.js --env production`).toString());
  process.send('build finished!');
  process.send({ isBuildSuccess: true })
} catch (err) {
  console.error('build failed!');
  console.error(err);
  process.send({ isBuildSuccess: false })
}

process.on('message', (message) => {
  console.log(`message`);
})