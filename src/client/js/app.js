import io from 'socket.io-client';

import '../css/main.scss';
import './requestAnimationFrame';

import global from './global';
import Canvas from './canvas';
// import draw from './draw';

const playerConfig = {
  border: 6,
  textColor: '#FFFFFF',
  textBorder: '#666666',
  textBorderSize: 1,
  defaultSize: 30,
};

let player = {
  id: -1,
  x: global.screenWidth / 2,
  y: global.screenHeight / 2,
  screenWidth: global.screenWidth,
  screenHeight: global.screenHeight,
  target: {
    x: global.screenWidth / 2,
    y: global.screenHeight / 2,
  },
};

let foods = [];
let viruses = [];
let playerFoods = [];
let users = [];
let leaderboard = [];
const target = {
  x: player.x,
  y: player.y,
};
let socket;
let playerNameInput;

global.target = target;
global.player = player;

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
  global.mobile = true;
}

const canvas = new Canvas('canvas');
const cvs = canvas.cvs;
const context = canvas.context;

window.canvas = canvas;

const log = console.log.bind(console);


function $(query) {
  return document.querySelector(query);
}

// function $$(query) {
//   return document.querySelectorAll(query);
// }

function validNick() {
  const regex = /^\w+$/;
  return regex.test(playerNameInput.value);
}

function valueInRange(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function resize() {
  if (!socket) return;

  if (global.playerType === 'player') {
    player.screenWidth = cvs.width = global.screenWidth = window.innerWidth;
    player.screenHeight = cvs.height = global.screenHeight = window.innerHeight;
  } else {
    player.screenWidth = cvs.width = global.screenWidth = global.gameWidth;
    player.screenHeight = cvs.height = global.screenHeight = global.gameHeight;
  }

  if (global.playerType === 'observer') {
    player.x = global.gameWidth / 2;
    player.y = global.gameHeight / 2;
  }

  socket.emit('windowResized', {
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
  });
}

function setupSocket(socket) {
  // Handle ping.
  socket.on('pingCheck', () => {
    // const latency = Date.now() - global.startPingTime;
    // log(`Latency: ${latency}ms`);
    // window.chat.addSystemLine(`Ping: ${latency}ms`);
    calculatePing(Date.now());
  });

  // // Handle error.
  socket.on('connect_failed', () => {
    socket.close();
    global.disconnected = true;
  });

  socket.on('disconnect', () => {
    socket.close();
    global.disconnected = true;
  });

  // Handle connection.
  socket.on('welcome', (playerSettings) => {
    player = playerSettings;
    player.name = global.playerName;
    player.screenWidth = global.screenWidth;
    player.screenHeight = global.screenHeight;
    player.w = global.screenWidth;
    player.h = global.screenHeight;
    player.target = window.canvas.target;
    global.player = player;
    // window.chat.player = player;
    socket.emit('gotit', player);
    global.gameStart = true;
    log(`Game started at: ${global.gameStart}`);
    // window.chat.addSystemLine('Connected to the game!');
    // window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
    // if (global.mobile) {
    //   document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
    // }
    cvs.focus();
  });

  socket.on('gameSetup', (data) => {
    global.gameWidth = data.gameWidth;
    global.gameHeight = data.gameHeight;
    resize();
  });

  // socket.on('playerDied', (data) => {
  //   window.chat.addSystemLine(`{GAME} - <b>${data.name.length < 1 ?
  // 'An unnamed cell' : data.name}</b> was eaten.`);
  // });

  socket.on('playerDisconnect', (data) => {
    //   window.chat.addSystemLine(`{GAME} - <b>${data.name.length < 1 ?
    // 'An unnamed cell' : data.name}</b> disconnected.`);
    log(`{GAME} - <b>${data.name.length < 1 ?
      'An unnamed cell' : data.name}</b> disconnected.`);
  });

  socket.on('playerJoin', (data) => {
    //   window.chat.addSystemLine(`{GAME} - <b>${data.name.length < 1 ?
    // 'An unnamed cell' : data.name}</b> joined.`);
    log(`{GAME} - <b>${data.name.length < 1 ?
      'An unnamed cell' : data.name}</b> joined.`);
  });

  socket.on('leaderboard', (data) => {
    leaderboard = data.leaderboard;
    let status = '';
    for (let i = 0; i < leaderboard.length; i++) {
      if (leaderboard[i].id === player.id) {
        if (leaderboard[i].name.length !== 0) {
          status += `<li class="me">${i + 1}. ${leaderboard[i].name}</li>`;
        } else {
          status += `<li class="me">${i + 1}. An unnamed cell</li>`;
        }
      } else if (leaderboard[i].name.length !== 0) {
        status += `${i + 1}. ${leaderboard[i].name}`;
      } else {
        status += `${i + 1}. An unnamed cell`;
      }
    }
    // status += '<br />Players: ' + data.players;
    $('#leadboard').innerHTML = status;
  });

  // socket.on('serverMSG', (data) => {
  //   window.chat.addSystemLine(data);
  // });

  // // Chat.
  // socket.on('serverSendPlayerChat', (data) => {
  //   window.chat.addChatLine(data.sender, data.message, false);
  // });

  // Handle movement.
  socket.on('serverTellPlayerMove', (userData, foodsList, playerFoodList, virusList) => {
    let playerData;
    for (let i = 0; i < userData.length; i++) {
      if (typeof (userData[i].id) === 'undefined') {
        playerData = userData[i];
        i = userData.length;
      }
    }
    if (global.playerType === 'player') {
      const xoffset = player.x - playerData.x;
      const yoffset = player.y - playerData.y;

      player.x = playerData.x;
      player.y = playerData.y;
      player.hue = playerData.hue;
      player.massTotal = playerData.massTotal;
      player.cells = playerData.cells;
      player.xoffset = Number.isNaN(xoffset) ? 0 : xoffset;
      player.yoffset = Number.isNaN(yoffset) ? 0 : yoffset;
    }
    users = userData;
    foods = foodsList;
    viruses = virusList;
    playerFoods = playerFoodList;
  });

  // // Death.
  // socket.on('RIP', () => {
  //   global.gameStart = false;
  //   global.died = true;
  //   window.setTimeout(() => {
  //     document.getElementById('gameAreaWrapper').style.opacity = 0;
  //     document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
  //     global.died = false;
  //     if (global.animLoopHandle) {
  //       window.cancelAnimationFrame(global.animLoopHandle);
  //       global.animLoopHandle = undefined;
  //     }
  //   }, 2500);
  // });

  socket.on('kick', () => {
    global.gameStart = false;
    // reason = data;
    global.kicked = true;
    socket.close();
  });

  socket.on('virusSplit', () => {
    window.canvas.reenviar = false;
  });
}

// draw shapes

function drawCircle(centerX, centerY, radius, sides) {
  let theta = 0;
  let x = 0;
  let y = 0;

  context.beginPath();

  for (let i = 0; i < sides; i++) {
    theta = (i / sides) * 2 * Math.PI;
    x = centerX + radius * Math.sin(theta);
    y = centerY + radius * Math.cos(theta);
    context.lineTo(x, y);
  }

  context.closePath();
  context.stroke();
  context.fill();
}

function drawFood(food) {
  context.save();
  context.strokeStyle = `hsl(${food.hue}, 100%, 45%)`;
  context.fillStyle = `hsl(${food.hue}, 100%, 50%)`;
  context.lineWidth = 0;
  drawCircle(
    food.x - player.x + global.screenWidth / 2,
    food.y - player.y + global.screenHeight / 2,
    food.radius, global.foodSides,
  );
  context.restore();
}

function drawVirus(virus) {
  context.save();
  context.strokeStyle = virus.stroke;
  context.fillStyle = virus.fill;
  context.lineWidth = virus.strokeWidth;
  drawCircle(
    virus.x - player.x + global.screenWidth / 2,
    virus.y - player.y + global.screenHeight / 2,
    virus.radius, global.virusSides,
  );
  context.restore();
}

function drawPlayerFood(playerFood) {
  context.save();
  context.strokeStyle = `hsl(${playerFood.hue}, 100%, 45%)`;
  context.fillStyle = `hsl(${playerFood.hue}, 100%, 50%)`;
  context.lineWidth = playerConfig.border + 10;
  drawCircle(
    playerFood.x - player.x + global.screenWidth / 2,
    playerFood.y - player.y + global.screenHeight / 2,
    playerFood.radius - 5, 18 + (~~(playerFood.pfMass / 5)),
  );
  context.restore();
}

function drawGrid(x, y) {
  context.save();
  context.strokeStyle = global.lineColor;
  context.lineWidth = 0.5;

  for (let i = global.xoffset - player.x; i < global.screenWidth - global.xoffset; i += global.screenHeight / x) {
    context.moveTo(i, global.yoffset);
    context.lineTo(i, global.screenHeight - global.yoffset);
  }

  for (let j = global.yoffset - player.y; j < global.screenHeight - global.yoffset; j += global.screenHeight / y) {
    context.moveTo(global.xoffset, j);
    context.lineTo(global.screenWidth - global.xoffset, j);
  }

  context.stroke();
  context.restore();
}

function drawText(text, x, y) {
  context.save();
  context.textAlign = 'start';
  context.textBaseline = 'top';
  context.fillStyle = '#339933';
  context.font = '30px sans-serif';

  context.fillText(text, x, y);
  context.restore();
}

function drawPlayers(order) {
  const start = {
    x: player.x - (global.screenWidth / 2),
    y: player.y - (global.screenHeight / 2),
  };

  for (let z = 0; z < order.length; z++) {
    const userCurrent = users[order[z].nCell];
    const cellCurrent = users[order[z].nCell].cells[order[z].nDiv];

    let x = 0;
    let y = 0;

    const points = 30 + ~~(cellCurrent.mass / 5);
    const increase = Math.PI * 2 / points;

    context.strokeStyle = `hsl(${userCurrent.hue}, 100%, 45%)`;
    context.fillStyle = `hsl(${userCurrent.hue}, 100%, 50%)`;
    context.lineWidth = playerConfig.border;

    const xstore = [];
    const ystore = [];

    global.spin += 0.0;

    const circle = {
      x: cellCurrent.x - start.x,
      y: cellCurrent.y - start.y,
    };

    for (let i = 0; i < points; i++) {
      x = cellCurrent.radius * Math.cos(global.spin) + circle.x;
      y = cellCurrent.radius * Math.sin(global.spin) + circle.y;
      if (typeof (userCurrent.id) === 'undefined') {
        x = valueInRange(
          -userCurrent.x + global.screenWidth / 2,
          global.gameWidth - userCurrent.x + global.screenWidth / 2, x,
        );
        y = valueInRange(
          -userCurrent.y + global.screenHeight / 2,
          global.gameHeight - userCurrent.y + global.screenHeight / 2, y,
        );
      } else {
        x = valueInRange(
          -cellCurrent.x - player.x + global.screenWidth / 2 + (cellCurrent.radius / 3),
          global.gameWidth - cellCurrent.x + global.gameWidth - player.x +
          global.screenWidth / 2 - (cellCurrent.radius / 3), x,
        );
        y = valueInRange(
          -cellCurrent.y - player.y + global.screenHeight / 2 + (cellCurrent.radius / 3),
          global.gameHeight - cellCurrent.y + global.gameHeight - player.y +
          global.screenHeight / 2 - (cellCurrent.radius / 3), y,
        );
      }
      global.spin += increase;
      xstore[i] = x;
      ystore[i] = y;
    }
    /* if (wiggle >= player.radius/ 3) inc = -1;
     *if (wiggle <= player.radius / -3) inc = +1;
     *wiggle += inc;
     */
    for (let i = 0; i < points; ++i) {
      if (i === 0) {
        context.beginPath();
        context.moveTo(xstore[i], ystore[i]);
      } else if (i > 0 && i < points - 1) {
        context.lineTo(xstore[i], ystore[i]);
      } else {
        context.lineTo(xstore[i], ystore[i]);
        context.closePath();
      }
    }
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.fill();
    context.stroke();
    let nameCell = '';
    if (typeof (userCurrent.id) === 'undefined') {
      nameCell = player.name;
    } else {
      nameCell = userCurrent.name;
    }

    let fontSize = Math.max(cellCurrent.radius / 3, 12);
    context.lineWidth = playerConfig.textBorderSize;
    context.fillStyle = playerConfig.textColor;
    context.strokeStyle = playerConfig.textBorder;
    context.miterLimit = 1;
    context.lineJoin = 'round';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `bold ${fontSize}px sans-serif`;

    if (!global.visibleMass) {
      context.strokeText(nameCell, circle.x, circle.y);
      context.fillText(nameCell, circle.x, circle.y);
    } else {
      context.strokeText(nameCell, circle.x, circle.y);
      context.fillText(nameCell, circle.x, circle.y);
      context.font = `bold ${Math.max(fontSize / 3 * 2, 10)}px sans-serif`;
      if (nameCell.length === 0) fontSize = 0;
      context.strokeText(Math.round(cellCurrent.mass), circle.x, circle.y + fontSize);
      context.fillText(Math.round(cellCurrent.mass), circle.x, circle.y + fontSize);
    }
  }
}

function drawborder() {
  context.lineWidth = 2;

  const halfWidth = global.screenWidth / 2;
  const halfHeight = global.screenHeight / 2;
  // Left-vertical.
  if (player.x <= halfWidth) {
    context.beginPath();
    context.moveTo(
      halfWidth - player.x,
      player.y > halfHeight ? 0 : halfHeight - player.y,
    );
    context.lineTo(
      halfWidth - player.x,
      global.gameHeight - player.y > halfHeight ?
        global.screenHeight : halfHeight + global.gameHeight - player.y,
    );
    context.strokeStyle = global.lineColor;
    context.stroke();
  }

  // Top-horizontal.
  if (player.y <= halfHeight) {
    context.beginPath();
    context.moveTo(
      player.x > halfWidth ? 0 : halfWidth - player.x,
      halfHeight - player.y,
    );
    context.lineTo(
      global.gameWidth - player.x > halfWidth ?
        global.screenWidth : halfWidth + global.gameWidth - player.x,
      halfHeight - player.y,
    );
    context.strokeStyle = global.lineColor;
    context.stroke();
  }

  // Right-vertical.
  if (global.gameWidth - player.x <= halfWidth) {
    context.beginPath();
    context.moveTo(
      global.gameWidth + halfWidth - player.x,
      player.y > halfHeight ? 0 : halfHeight - player.y,
    );
    context.lineTo(
      global.gameWidth + halfWidth - player.x,
      global.gameHeight - player.y > halfHeight ?
        global.screenHeight : halfHeight + global.gameHeight - player.y,
    );
    context.strokeStyle = global.lineColor;
    context.stroke();
  }

  // Bottom-horizontal.
  if (global.gameHeight - player.y <= halfHeight) {
    context.beginPath();
    context.moveTo(
      player.x > halfWidth ? 0 : halfWidth - player.x,
      global.gameHeight + halfHeight - player.y,
    );
    context.lineTo(
      global.gameWidth - player.x > halfWidth ?
        global.screenWidth : halfWidth + global.gameWidth - player.x,
      global.gameHeight + halfHeight - player.y,
    );
    context.strokeStyle = global.lineColor;
    context.stroke();
  }
}

// start game

function startGame(type) {
  global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
  global.playerType = type;

  global.screenWidth = window.innerWidth;
  global.screenHeight = window.innerHeight;

  $('.startMenuWrapper').style.display = 'none';
  // document.getElementById('gameAreaWrapper').style.opacity = 1;
  if (!socket) {
    socket = io({
      query: `type=${type}`,
    });
    setupSocket(socket);
  }
  if (!global.animLoopHandle) {
    requestAnimationFrame(animloop);
  }
  socket.emit('respawn');
  // window.chat.socket = socket;
  // window.chat.registerFunctions();
  window.canvas.socket = socket;
  global.socket = socket;
}

// game loop

function gameLoop(timeStamp) {
  if (global.died) {
    context.fillStyle = '#333333';
    context.fillRect(0, 0, global.screenWidth, global.screenHeight);

    context.textAlign = 'center';
    context.fillStyle = '#FFFFFF';
    context.font = 'bold 30px sans-serif';
    context.fillText('You died!', global.screenWidth / 2, global.screenHeight / 2);
  } else if (!global.disconnected) {
    if (global.gameStart) {
      if (global.darkMode) {
        context.fillStyle = global.darkBGColor;
      } else {
        context.fillStyle = global.lightBGColor;
      }
      context.fillRect(0, 0, cvs.width, cvs.height);

      context.save();
      context.transform(
        global.scale, 0, 0, global.scale,
        (1 - global.scale) * cvs.width / 2, (1 - global.scale) * cvs.height / 2,
      );

      drawGrid(20, 20);
      foods.forEach(drawFood);
      playerFoods.forEach(drawPlayerFood);
      viruses.forEach(drawVirus);

      if (global.visibleBorder) {
        drawborder();
      }
      const orderMass = [];
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < users[i].cells.length; j++) {
          orderMass.push({
            nCell: i,
            nDiv: j,
            mass: users[i].cells[j].mass,
          });
        }
      }
      orderMass.sort((obj1, obj2) => obj1.mass - obj2.mass);
      drawPlayers(orderMass);
      context.restore();

      if (global.visibleFps) {
        calculateFps(timeStamp);
        drawText(`${global.lastFpsUpdate}fps`, 0, 0);
      }
      if (global.visiblePing) {
        pingCheck();
        drawText(`${global.lastPingUpdate}ms`, 0, 40);
      }

      socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
    } else {
      context.fillStyle = '#333333';
      context.fillRect(0, 0, global.screenWidth, global.screenHeight);

      context.textAlign = 'center';
      context.fillStyle = '#FFFFFF';
      context.font = 'bold 30px sans-serif';
      context.fillText('Game Over!', global.screenWidth / 2, global.screenHeight / 2);
    }
  } else {
    // context.fillStyle = '#333333';
    // context.fillRect(0, 0, global.screenWidth, global.screenHeight);

    // context.textAlign = 'center';
    // context.fillStyle = '#FFFFFF';
    // context.font = 'bold 30px sans-serif';
    // if (global.kicked) {
    //   if (reason !== '') {
    //     context.fillText('You were kicked for:',
    // global.screenWidth / 2, global.screenHeight / 2 - 20);
    //     context.fillText(reason, global.screenWidth / 2, global.screenHeight / 2 + 20);
    //   } else {
    //     context.fillText('You were kicked!', global.screenWidth / 2, global.screenHeight / 2);
    //   }
    // } else {
    //   context.fillText('Disconnected!', global.screenWidth / 2, global.screenHeight / 2);
    // }
  }
}


function calculateFps(timeStamp) {
  if (timeStamp - global.lastFpsUpdateTime > global.fpsUpdateFrequency) {
    const fps = 1000 / (timeStamp - global.startFpsTime);

    global.lastFpsUpdateTime = timeStamp;
    global.lastFpsUpdate = fps.toFixed();
  }

  global.startFpsTime = timeStamp;
}

function calculatePing(timeStamp) {
  if (timeStamp - global.lastPingUpdateTime > global.pingUpdateFrequency) {
    const latency = timeStamp - global.startPingTime;

    global.lastPingUpdateTime = timeStamp;
    global.lastPingUpdate = latency;
  }
}

function pingCheck() {
  global.startPingTime = Date.now();
  socket.emit('pingCheck');
}

function animloop(timeStamp) {
  global.animLoopHandle = requestAnimationFrame(animloop);
  gameLoop(timeStamp);
}


window.onload = function () {
  window.addEventListener('resize', resize);
  drawGrid(20, 20);

  playerNameInput = $('#playerNameInput');
  const nickErr = $('#nickError');
  const startBtn = $('#startButton');
  const obBtn = $('#observerButton');
  const setBtn = $('#settingsButton');
  const set = $('.setting');
  const visFps = $('#visFps');
  const visPing = $('#visPing');
  const visMass = $('#visMass');
  const visBorder = $('#visBorder');
  const darkMode = $('#darkMode');

  visFps.checked = global.visibleFps;
  visPing.checked = global.visiblePing;
  visMass.checked = global.visibleMass;
  visBorder.checked = global.visibleBorder;
  darkMode.checked = global.darkMode;

  startBtn.addEventListener('click', () => {
    if (validNick()) {
      nickErr.style.opacity = 0;
      startGame('player');
    } else {
      nickErr.style.opacity = 1;
    }
  });

  obBtn.addEventListener('click', () => {
    startGame('observer');
  });

  setBtn.addEventListener('click', () => {
    if (set.style.maxHeight === '130px') {
      set.style.maxHeight = '0px';
    } else {
      set.style.maxHeight = '130px';
    }
  });

  visFps.addEventListener('click', () => {
    global.visibleFps = visFps.checked;
  });

  visPing.addEventListener('click', () => {
    global.visiblePing = visPing.checked;
  });

  visMass.addEventListener('click', () => {
    global.visibleMass = visMass.checked;
  });

  visBorder.addEventListener('click', () => {
    global.visibleBorder = visBorder.checked;
  });

  darkMode.addEventListener('click', () => {
    global.darkMode = darkMode.checked;
  });
};
