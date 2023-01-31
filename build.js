import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import shell from 'shelljs';
import dotenv from 'dotenv';

const argv = yargs(hideBin(process.argv)).argv;
const projectName = argv.projectName;
const homeDir = argv.homeDir;

dotenv.config({ path: path.join(homeDir, `${projectName}.env`) })

shell.cd('~/manager')
try {
    shell.rm('-rf', `~/manager/${projectName}*`)
    console.log(`Successfully Removed ${projectName}s`)
} catch (err) {
    console.log(`failed to remove ${projectName}`);
    console.error(err);
}

let output = shell.exec(`git clone ${argv.repoUrl} ${projectName}_${argv.buildStartTime}`);
process.send(output.toString());
shell.cd(`${projectName}_${argv.buildStartTime}`);
process.send(shell.exec(`npm ci`).toString());
process.send(shell.exec(`REMOTE_PATTERNS_URLS=${process.env.REMOTE_PATTERNS_URLS} npm run build`).toString());
process.send(shell.exec(`pm2 delete ${projectName}`).toString());
shell.cp(path.join(homeDir, `${projectName}.ecosystem.config.js`), `./ecosystem.config.js`)
process.send(shell.exec(`pm2 start ecosystem.config.js --env production`).toString());

process.on('message', (message) => {
    console.log(`message`);
})