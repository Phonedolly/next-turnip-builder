import path from 'path'
// import dotenv from 'dotenv'
import { format } from 'date-fns-tz';
import crocket from 'crocket';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fork } from 'child_process';

const now = () => format(Date.now(), "yyyy-MM-dd hh:mm.ss") + ": ";

const runningBuildTasks = {};

const argv = yargs(hideBin(process.argv)).argv

if (fs.existsSync('/tmp/next-turnip.sock')) {
  fs.rmSync('/tmp/next-turnip.sock');
}

/* Standalone Mode */
if ((argv.initiate === true || argv.i === true) &&
  (argv.projectName !== undefined || argv.p !== undefined)) {
  const buildStartTime = Number(Date.now());
  const newBuildTask = fork('./build.js', ['--buildStartTime', buildStartTime, '--projectName', argv.projectName, '--homeDir', path.join(path.resolve())]);
  newBuildTask.on('message', (msg) => {
  })
  newBuildTask.on('exit', function() {
    process.exit(0)
  })
} else if (argv.i === true && argv.projectName === undefined) {
  console.log('projectName is not specified\n');
  process.exit(0);
}

const server = new crocket();

server.listen({ path: '/tmp/next-turnip.sock' }, (err) => {
  if (err) {
    throw err;
  }
  console.log('connected');
  console.log('IPC Listening On /tmp/next-turnip.sock');
});

server.on('/request/getBuildConfig', (payload) => {
  console.log(payload)
  if (!fs.existsSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.ecosystem.config.js`))) {
    fs.writeFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.ecosystem.config.js`), "");
  }
  if (!fs.existsSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.env`))) {
    fs.writeFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.env`), "");
  }
  const pm2Config = fs.readFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.ecosystem.config.js`)).toString()
  const dotEnv = fs.readFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.env`)).toString()
  server.emit('/response/getBuildConfig', { pm2Config, dotEnv })
})

server.on('/request/setBuildConfig', (payload) => {
  console.log(payload)
  try {
    fs.writeFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.ecosystem.config.js`), payload.newPm2Config);
    fs.writeFileSync(path.join(path.resolve(), `${payload.projectName.toLowerCase()}.env`), payload.newDotEnv)
    server.emit('/response/setBuildConfig', { isSetBuildConfigSuccess: true });
  } catch (err) {
    console.error(err);
    server.emit('/response/setBuildConfig', { isSetBuildConfigSuccess: false });
  }
})

server.on('/request/startBuild', (payload) => {
  console.log('start build');
  console.log(payload);
  /* Remove Running Build Task */
  if (runningBuildTasks[`${payload.projectName}`] !== undefined) {
    runningBuildTasks[`${payload.projectName}`].process.kill('SIGKILL');
    delete runningBuildTasks[`${payload.projectName}`]
    console.log('Removed Already Running Task');
  }
  const buildStartTime = Number(Date.now());
  const newBuildTask = fork('./build.js', ['--repoUrl', payload.repoUrl, '--buildStartTime', buildStartTime, '--projectName', payload.projectName, '--homeDir', path.join(path.resolve())]);

  runningBuildTasks[payload.projectName] = {
    process: newBuildTask,
    log: '',
    buildStartTime,
    isBuildFinished: false,
    isBuildSuccess: undefined
  }

  newBuildTask.on('message', (msg) => {
    if (typeof msg === 'string') {
      runningBuildTasks[`${payload.projectName}`].log += '\n' + msg;
    } else if (typeof msg === 'object') {
      if (msg.isBuildSuccess === true) {
        runningBuildTasks[`${payload.projectName}`].isBuildFinished = true;
        runningBuildTasks[`${payload.projectName}`].isBuildSuccess = true;
      } else if (msg.isBuildSuccess === false) {
        runningBuildTasks[`${payload.projectName}`].isBuildFinished = true;
        runningBuildTasks[`${payload.projectName}`].isBuildSuccess = false;
      }
    }
  })

  server.emit('/response/startBuild', {
    request: payload,
    isSuccessStartBuild: true,
    buildStartTime
  });
  console.log(runningBuildTasks);
})

server.on('/request/getBuildStatus', (payload) => {
  if (runningBuildTasks[`${[payload.projectName]}`] === undefined) {
    console.error(`${payload.projectName} is not building`);
    return server.emit('/response/getBuildStatus', {
      projectName: payload.projectName,
      log: null
    })
  }
  // console.log(runningBuildTasks[`${payload.projectName}`])
  server.emit('/response/getBuildStatus', {
    projectName: payload.projectName,
    log: runningBuildTasks[`${payload.projectName}`].log,
    buildStartTime: runningBuildTasks[`${payload.projectName}`].buildStartTime,
    isBuildFinished: runningBuildTasks[`${payload.projectName}`].isBuildFinished,
    isBuildSuccess: runningBuildTasks[`${payload.projectName}`].isBuildSuccess
  })
})

server.on('error', (e) => {
  console.error('Communication Error Occurred');
  console.error(e);
})