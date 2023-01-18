const path = require('path')
const dotenv = require('dotenv')
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const { format } = require('date-fns-tz');
const Category = require('./schemas/category');

/* initialize date function */
exports.now = () => format(Date.now(), "yyyy-MM-dd hh:mm.ss") + ": ";

const dbus = require('@homebridge/dbus-native');

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(__dirname, './.env.production') });
  console.log(exports.now() + "MODE: PRODUCTION");
} else if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: path.join(__dirname, './.env.development') });
  console.log(exports.now() + "MODE: DEVELOPMENT");
} else {
  throw new Error(exports.now() + 'process.env.NODE_ENV is not set');
}

const bus = dbus.sessionBus();
const name = 'org.next.turnip';
bus.connection.on('message', function (msg) {
  if (
    msg.destination === name &&
    msg['interface'] === 'org.next.turnip.builder' &&
    msg.path === '/0/1' &&
    msg.body === 'BUILD_START'
  ) {
    const reply = {
      type: dbus.messageType.methodReturn,
      destination: msg.sender,
      replySerial: msg.serial,
      sender: name,
      signature: 's',
      body: [
        'ATTEMPT_BUILD'
      ]
    };
    bus.invoke(reply)
  }
});
bus.requestName(name, 0);