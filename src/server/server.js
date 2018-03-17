const path = require('path');

const express = require('express');
const SAT = require('sat');
const quadtree = require('simple-quadtree');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Import game settings.
const config = require('../../config.json');
// Import utilities.
const util = require('./lib/util');

const tree = quadtree(0, 0, config.gameWidth, config.gameHeight);

const V = SAT.Vector;
const C = SAT.Circle;

const food = [];
const virus = [];
const playerFood = [];
const users = [];
const sockets = {};

let leaderboard = [];
let leaderboardChanged = false;

app.use(express.static(path.join(__dirname, '/../../')));

const log = console.log.bind(console);
const initMassLog = util.getBaseLog(config.defaultPlayerMass, config.slowBase);

function addFood(toAdd) {
  const radius = util.massToRadius(config.foodMass);
  while (toAdd--) {
    const position = config.foodUniformDisposition ?
      util.uniformPosition(food, radius) : util.randomPosition(radius);

    food.push({
      // Make IDs unique.
      id: (`${+new Date()}${food.length}`) >>> 0,
      x: position.x,
      y: position.y,
      radius,
      mass: Math.random() + 2,
      hue: Math.round(Math.random() * 360),
    });
  }
}

function addVirus(toAdd) {
  while (toAdd--) {
    const mass = util.randomInRange(config.virus.defaultMass.from, config.virus.defaultMass.to);
    const radius = util.massToRadius(mass);
    const position = config.virusUniformDisposition ?
      util.uniformPosition(virus, radius) : util.randomPosition(radius);

    virus.push({
      id: (`${+new Date()}${virus.length}`) >>> 0,
      x: position.x,
      y: position.y,
      radius,
      mass,
      fill: config.virus.fill,
      stroke: config.virus.stroke,
      strokeWidth: config.virus.strokeWidth,
    });
  }
}

function removeFood(toRem) {
  while (toRem--) {
    food.pop();
  }
}

function balanceMass() {
  const totalMass = food.length * config.foodMass +
    users
      .map(u => u.massTotal)
      .reduce((pu, cu) => pu + cu, 0);

  const massDiff = config.gameMass - totalMass;
  const maxFoodDiff = config.maxFood - food.length;
  const foodDiff = parseInt(massDiff / config.foodMass, 10) - maxFoodDiff;
  const foodToAdd = Math.min(foodDiff, maxFoodDiff);
  const foodToRemove = -Math.max(foodDiff, maxFoodDiff);

  if (foodToAdd > 0) {
    log(`[DEBUG] Adding ${foodToAdd} food to level!`);
    addFood(foodToAdd);
    log('[DEBUG] Mass rebalanced!');
  } else if (foodToRemove > 0) {
    log(`[DEBUG] Removing ${foodToRemove} food from level!`);
    removeFood(foodToRemove);
    log('[DEBUG] Mass rebalanced!');
  }

  const virusToAdd = config.maxVirus - virus.length;

  if (virusToAdd > 0) {
    addVirus(virusToAdd);
  }
}


function splitCells(currentPlayer) {
  function splitCell(cell) {
    cell.mass /= 2;
    cell.radius = util.massToRadius(cell.mass);
    return {
      mass: cell.mass,
      x: cell.x,
      y: cell.y,
      radius: cell.radius,
      speed: 25,
    };
  }

  const numCells = currentPlayer.cells.length;
  let numSplit = config.limitSplit - numCells;
  if (numSplit > 0 && currentPlayer.massTotal >= config.defaultPlayerMass * 2) {
    for (let i = 0; i < numCells; i++) {
      if ((currentPlayer.cells[i].mass >= config.defaultPlayerMass * 2) && numSplit) {
        numSplit--;
        currentPlayer.cells.push(splitCell(currentPlayer.cells[i]));
      }
    }
    currentPlayer.lastSplit = +new Date();
  }
}

function virusSplitCells(currentPlayer, virusCell) {
  function splitCell1(cell, num) {
    const cellMass = cell.mass * 0.6 / num;
    cell.mass *= 0.4;
    cell.radius = util.massToRadius(cell.mass);

    return {
      mass: cellMass,
      x: cell.x,
      y: cell.y,
      radius: util.massToRadius(cellMass),
      speed: 6.25,
    };
  }

  const numCells = currentPlayer.cells.length;
  const numSplit = config.limitSplit - numCells;
  const numVirusSplit = Math.min(numSplit, 12);

  if (numVirusSplit > 0) {
    const cell = splitCell1(currentPlayer.cells[virusCell], numVirusSplit);
    const deg = Math.PI * 2 / numVirusSplit;
    for (let i = 0; i < numVirusSplit; i++) {
      currentPlayer.cells.push(Object.assign({}, cell, {
        x: cell.x + cell.radius + 200 * Math.cos(deg * i),
        y: cell.y + cell.radius + 200 * Math.sin(deg * i),
      }));
    }
    currentPlayer.lastSplit = +new Date();
  }
}

function movePlayer(player) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < player.cells.length; i++) {
    const target = {
      x: player.x - player.cells[i].x + player.target.x,
      y: player.y - player.cells[i].y + player.target.y,
    };
    const dist = Math.sqrt(target.y ** 2 + target.x ** 2);
    const deg = Math.atan2(target.y, target.x);
    let slowDown = 1;
    if (player.cells[i].speed <= 6.25) {
      slowDown = util.getBaseLog(player.cells[i].mass, config.slowBase) - initMassLog + 1;
    }

    let deltaY = player.cells[i].speed * Math.sin(deg) / slowDown;
    let deltaX = player.cells[i].speed * Math.cos(deg) / slowDown;

    if (player.cells[i].speed > 6.25) {
      player.cells[i].speed -= 0.5;
    }
    if (dist < (50 + player.cells[i].radius)) {
      deltaY *= dist / (50 + player.cells[i].radius);
      deltaX *= dist / (50 + player.cells[i].radius);
    }
    if (!Number.isNaN(deltaY)) {
      player.cells[i].y += deltaY;
    }
    if (!Number.isNaN(deltaX)) {
      player.cells[i].x += deltaX;
    }
    // Find best solution.
    for (let j = 0; j < player.cells.length; j++) {
      if (j !== i && player.cells[i] !== undefined) {
        const distance = Math.sqrt((player.cells[j].y - player.cells[i].y) ** 2 +
            (player.cells[j].x - player.cells[i].x) ** 2);
        const radiusTotal = player.cells[i].radius + player.cells[j].radius;
        if (distance < radiusTotal) {
          if (player.lastSplit > +new Date() - 1000 * config.mergeTimer) {
            if (player.cells[i].x < player.cells[j].x) {
              player.cells[i].x--;
            } else if (player.cells[i].x > player.cells[j].x) {
              player.cells[i].x++;
            }
            if (player.cells[i].y < player.cells[j].y) {
              player.cells[i].y--;
            } else if ((player.cells[i].y > player.cells[j].y)) {
              player.cells[i].y++;
            }
          } else if (distance < radiusTotal / 1.75) {
            player.cells[i].mass += player.cells[j].mass;
            player.cells[i].radius = util.massToRadius(player.cells[i].mass);
            player.cells.splice(j, 1);
          }
        }
      }
    }
    if (player.cells.length > i) {
      const borderCalc = player.cells[i].radius / 3;
      if (player.cells[i].x > config.gameWidth - borderCalc) {
        player.cells[i].x = config.gameWidth - borderCalc;
      }
      if (player.cells[i].y > config.gameHeight - borderCalc) {
        player.cells[i].y = config.gameHeight - borderCalc;
      }
      if (player.cells[i].x < borderCalc) {
        player.cells[i].x = borderCalc;
      }
      if (player.cells[i].y < borderCalc) {
        player.cells[i].y = borderCalc;
      }
      x += player.cells[i].x;
      y += player.cells[i].y;
    }
  }
  player.x = x / player.cells.length;
  player.y = y / player.cells.length;
}

function tickPlayer(currentPlayer) {
  let playerCircle;
  let currentCell;
  let z;
  const playerCollisions = [];

  if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
    sockets[currentPlayer.id].emit('kick', `Last heartbeat received over ${config.maxHeartbeatInterval}ms ago.`);
    sockets[currentPlayer.id].disconnect();
  }

  movePlayer(currentPlayer);

  function eatFood(f) {
    return SAT.pointInCircle(new V(f.x, f.y), playerCircle);
  }

  function deleteFood(f) {
    food[f] = {};
    food.splice(f, 1);
  }

  function eatPFood(m) {
    if (SAT.pointInCircle(new V(m.x, m.y), playerCircle)) {
      if (m.id === currentPlayer.id && m.speed > 0 && z === m.num) {
        return false;
      }
      if (currentCell.mass > m.pfMass * 1.1) {
        return true;
      }
    }
    return false;
  }

  function check(user) {
    for (let i = 0; i < user.cells.length; i++) {
      if (user.cells[i].mass > 10 && user.id !== currentPlayer.id) {
        const response = new SAT.Response();
        const collided = SAT.testCircleCircle(
          playerCircle,
          new C(new V(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
          response,
        );
        if (collided) {
          response.aUser = currentCell;
          response.bUser = {
            id: user.id,
            name: user.name,
            x: user.cells[i].x,
            y: user.cells[i].y,
            num: i,
            mass: user.cells[i].mass,
          };
          playerCollisions.push(response);
        }
      }
    }
    return true;
  }

  function collisionCheck(collision) {
    if (collision.aUser.mass > collision.bUser.mass * 1.1 &&
        collision.aUser.radius > Math.sqrt((collision.aUser.x - collision.bUser.x) ** 2 +
          (collision.aUser.y - collision.bUser.y) ** 2)) {
      log(`[DEBUG] Killing user: ${collision.bUser.id}`);
      log('[DEBUG] Collision info:');
      log(collision);

      const numUser = util.findIndex(users, collision.bUser.id);
      if (numUser > -1) {
        if (users[numUser].cells.length > 1) {
          users[numUser].massTotal -= collision.bUser.mass;
          users[numUser].cells.splice(collision.bUser.num, 1);
        } else {
          users.splice(numUser, 1);
          io.emit('playerDied', {
            name: collision.bUser.name,
          });
          sockets[collision.bUser.id].emit('RIP');
        }
      }
      currentPlayer.massTotal += collision.bUser.mass;
      collision.aUser.mass += collision.bUser.mass;
    }
  }

  const length = currentPlayer.cells.length;

  for (z = 0; z < length; z++) {
    currentCell = currentPlayer.cells[z];
    playerCircle = new C(
      new V(currentCell.x, currentCell.y),
      currentCell.radius,
    );

    const foodEaten = food.map(eatFood)
      .reduce((a, b, c) => (b ? a.concat(c) : a), []);
    foodEaten.forEach(deleteFood);

    const pFoodEaten = playerFood.map(eatPFood)
      .reduce((a, b, c) => (b ? a.concat(c) : a), []);

    const virusCollision = virus.map(eatFood)
      .reduce((a, b, c) => (b ? a.concat(c) : a), []);

    if (typeof (currentCell.speed) === 'undefined') {
      currentCell.speed = 6.25;
    }


    let massTotal = 0;
    massTotal += (foodEaten.length * config.foodMass);

    for (let m = 0; m < pFoodEaten.length; m++) {
      massTotal += playerFood[pFoodEaten[m]].pfMass;
      playerFood[pFoodEaten[m]] = {};
      playerFood.splice(pFoodEaten[m], 1);
      for (let n = 0; n < pFoodEaten.length; n++) {
        if (pFoodEaten[m] < pFoodEaten[n]) {
          pFoodEaten[n]--;
        }
      }
    }

    if (virusCollision > 0 && currentCell.mass > virus[virusCollision].mass) {
      currentCell.mass += virus[virusCollision].mass;
      currentPlayer.massTotal += virus[virusCollision].mass;
      sockets[currentPlayer.id].emit('virusSplit');
      virusSplitCells(currentPlayer, z);
      virus.splice(virusCollision, 1);
    }

    currentCell.mass += massTotal;
    currentPlayer.massTotal += massTotal;
    currentCell.radius = util.massToRadius(currentCell.mass);
    playerCircle.r = currentCell.radius;

    tree.clear();
    users.forEach(tree.put);

    tree.get(currentPlayer, check);

    playerCollisions.forEach(collisionCheck);
  }
}

function movePlayerFood(pFood) {
  const deg = Math.atan2(pFood.target.y, pFood.target.x);
  const deltaY = pFood.speed * Math.sin(deg);
  const deltaX = pFood.speed * Math.cos(deg);

  pFood.speed -= 0.5;
  if (pFood.speed < 0) {
    pFood.speed = 0;
  }
  if (!Number.isNaN(deltaY)) {
    pFood.y += deltaY;
  }
  if (!Number.isNaN(deltaX)) {
    pFood.x += deltaX;
  }

  const borderCalc = pFood.radius + 5;

  if (pFood.x > config.gameWidth - borderCalc) {
    pFood.x = config.gameWidth - borderCalc;
  }
  if (pFood.y > config.gameHeight - borderCalc) {
    pFood.y = config.gameHeight - borderCalc;
  }
  if (pFood.x < borderCalc) {
    pFood.x = borderCalc;
  }
  if (pFood.y < borderCalc) {
    pFood.y = borderCalc;
  }
}

// user connected

io.on('connection', (socket) => {
  const type = socket.handshake.query.type;
  const radius = util.massToRadius(config.defaultPlayerMass);
  const position = config.newPlayerInitialPosition === 'farthest' ?
    util.uniformPosition(users, radius) : util.randomPosition(radius);

  let cells = [];
  let massTotal = 0;

  log('A user connected!', type);

  if (type === 'player') {
    cells = [{
      mass: config.defaultPlayerMass,
      x: position.x,
      y: position.y,
      radius,
    }];
    massTotal = config.defaultPlayerMass;
  }

  let currentPlayer = {
    id: socket.id,
    x: position.x,
    y: position.y,
    w: config.defaultPlayerMass,
    h: config.defaultPlayerMass,
    cells,
    massTotal,
    type,
    lastHeartbeat: +new Date(),
    hue: Math.round(Math.random() * 360),
    target: {
      x: 0,
      y: 0,
    },
  };

  socket.on('respawn', () => {
    if (util.findIndex(users, currentPlayer.id) > -1) {
      users.splice(util.findIndex(users, currentPlayer.id), 1);
    }
    socket.emit('welcome', currentPlayer);
    log(`[INFO] User ${currentPlayer.name} respawned!`);
  });

  socket.on('gotit', (player) => {
    log(`[INFO] Player ${player.name} connecting!`, player.id);

    if (util.findIndex(users, player.id) > -1) {
      log('[INFO] Player ID is already connected, kicking.');
      socket.disconnect();
    } else if (!util.validNick(player.name)) {
      socket.emit('kick', 'Invalid username.');
      socket.disconnect();
    } else {
      log(`[INFO] Player ${player.name} connected!`);
      sockets[player.id] = socket;

      const radius = util.massToRadius(config.defaultPlayerMass);
      const position = config.newPlayerInitialPosition === 'farthest' ?
        util.uniformPosition(users, radius) : util.randomPosition(radius);

      player.x = position.x;
      player.y = position.y;
      player.target.x = 0;
      player.target.y = 0;
      if (type === 'player') {
        player.cells = [{
          mass: config.defaultPlayerMass,
          x: position.x,
          y: position.y,
          radius,
        }];
        player.massTotal = config.defaultPlayerMass;
      } else {
        player.cells = [];
        player.massTotal = 0;
      }
      player.hue = Math.round(Math.random() * 360);
      currentPlayer = player;
      currentPlayer.lastHeartbeat = +new Date();
      users.push(currentPlayer);

      io.emit('playerJoin', {
        name: currentPlayer.name,
      });

      socket.emit('gameSetup', {
        gameWidth: config.gameWidth,
        gameHeight: config.gameHeight,
      });

      log(`Total players: ${users.length}`);
    }
  });

  socket.on('windowResized', (data) => {
    currentPlayer.screenWidth = data.screenWidth;
    currentPlayer.screenHeight = data.screenHeight;
    currentPlayer.w = data.screenWidth;
    currentPlayer.h = data.screenHeight;
  });

  socket.on('pingCheck', () => {
    socket.emit('pingCheck');
  });

  socket.on('disconnect', () => {
    if (util.findIndex(users, currentPlayer.id) > -1) {
      users.splice(util.findIndex(users, currentPlayer.id), 1);
    }
    log(`[INFO] User ${currentPlayer.name} disconnected!`);

    socket.broadcast.emit('playerDisconnect', {
      name: currentPlayer.name,
    });
  });

  // Heartbeat function, update everytime.
  socket.on('0', (target) => {
    currentPlayer.lastHeartbeat = +new Date();
    if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
      currentPlayer.target = target;
    }
  });

  socket.on('1', () => {
    // Fire food.
    for (let i = 0; i < currentPlayer.cells.length; i++) {
      if (((currentPlayer.cells[i].mass >= config.defaultPlayerMass + config.playerFoodMass) &&
            config.playerFoodMass > 0) || (currentPlayer.cells[i].mass >= 20 &&
            config.playerFoodMass === 0)) {
        let pfMass;
        if (config.playerFoodMass > 0) {
          pfMass = config.playerFoodMass;
        } else {
          pfMass = currentPlayer.cells[i].mass * 0.1;
        }
        currentPlayer.cells[i].mass -= pfMass;
        currentPlayer.massTotal -= pfMass;
        playerFood.push({
          id: currentPlayer.id,
          num: i,
          pfMass,
          hue: currentPlayer.hue,
          target: {
            x: currentPlayer.x - currentPlayer.cells[i].x + currentPlayer.target.x,
            y: currentPlayer.y - currentPlayer.cells[i].y + currentPlayer.target.y,
          },
          x: currentPlayer.cells[i].x,
          y: currentPlayer.cells[i].y,
          radius: util.massToRadius(pfMass),
          speed: 25,
        });
      }
    }
  });

  socket.on('2', () => {
    splitCells(currentPlayer);
  });
});


function gameloop() {
  if (users.length > 0) {
    users.sort((a, b) => b.massTotal - a.massTotal);

    const topUsers = [];

    for (let i = 0; i < Math.min(10, users.length); i++) {
      if (users[i].type === 'player') {
        topUsers.push({
          id: users[i].id,
          name: users[i].name,
        });
      }
    }
    if (Number.isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
      leaderboard = topUsers;
      leaderboardChanged = true;
    } else {
      for (let i = 0; i < leaderboard.length; i++) {
        if (leaderboard[i].id !== topUsers[i].id) {
          leaderboard = topUsers;
          leaderboardChanged = true;
          break;
        }
      }
    }
    for (let i = 0; i < users.length; i++) {
      for (let j = 0; j < users[i].cells.length; j++) {
        const massLoss = users[i].cells[j].mass * (config.massLossRate / 1000);
        if (users[i].cells[j].mass - massLoss > config.defaultPlayerMass &&
            users[i].massTotal > config.minMassLoss) {
          users[i].cells[j].mass -= massLoss;
          users[i].massTotal -= massLoss;
        }
      }
    }
  }
  balanceMass();
}

function sendUpdates() {
  users.forEach((u) => {
    // center the view if x/y is undefined, this will happen for spectators
    u.x = u.x || config.gameWidth / 2;
    u.y = u.y || config.gameHeight / 2;

    const visibleFood = food
      .map((f) => {
        if (f.x > u.x - config.playerVisibleWidth / 2 - 20 &&
            f.x < u.x + config.playerVisibleWidth / 2 + 20 &&
            f.y > u.y - config.playerVisibleHeight / 2 - 20 &&
            f.y < u.y + config.playerVisibleHeight / 2 + 20) {
          return f;
        }
        return undefined;
      })
      .filter(f => f);

    const visibleVirus = virus
      .map((f) => {
        if (f.x > u.x - config.playerVisibleWidth / 2 - f.radius &&
            f.x < u.x + config.playerVisibleWidth / 2 + f.radius &&
            f.y > u.y - config.playerVisibleHeight / 2 - f.radius &&
            f.y < u.y + config.playerVisibleHeight / 2 + f.radius) {
          return f;
        }
        return undefined;
      })
      .filter(f => f);

    const visibleMass = playerFood
      .map((f) => {
        if (f.x + f.radius > u.x - config.playerVisibleWidth / 2 - 20 &&
            f.x - f.radius < u.x + config.playerVisibleWidth / 2 + 20 &&
            f.y + f.radius > u.y - config.playerVisibleHeight / 2 - 20 &&
            f.y - f.radius < u.y + config.playerVisibleHeight / 2 + 20) {
          return f;
        }
        return undefined;
      })
      .filter(f => f);

    const visibleUsers = users
      .map((f) => {
        for (let z = 0; z < f.cells.length; z++) {
          if (f.cells[z].x + f.cells[z].radius > u.x - config.playerVisibleWidth / 2 - 20 &&
              f.cells[z].x - f.cells[z].radius < u.x + config.playerVisibleWidth / 2 + 20 &&
              f.cells[z].y + f.cells[z].radius > u.y - config.playerVisibleHeight / 2 - 20 &&
              f.cells[z].y - f.cells[z].radius < u.y + config.playerVisibleHeight / 2 + 20) {
            z = f.cells.lenth;
            if (f.id !== u.id) {
              return {
                id: f.id,
                x: f.x,
                y: f.y,
                cells: f.cells,
                massTotal: Math.round(f.massTotal),
                hue: f.hue,
                name: f.name,
              };
            }
            // log("Nombre: " + f.name + " Es Usuario");
            return {
              x: f.x,
              y: f.y,
              cells: f.cells,
              massTotal: Math.round(f.massTotal),
              hue: f.hue,
            };
          }
        }
        return undefined;
      })
      .filter(f => f);

    sockets[u.id].emit('serverTellPlayerMove', visibleUsers, visibleFood, visibleMass, visibleVirus);
    if (leaderboardChanged) {
      sockets[u.id].emit('leaderboard', {
        players: users.length,
        leaderboard,
      });
    }
  });
  leaderboardChanged = false;
}

function moveloop() {
  for (let i = 0; i < users.length; i++) {
    tickPlayer(users[i]);
  }
  for (let i = 0; i < playerFood.length; i++) {
    if (playerFood[i].speed > 0) movePlayerFood(playerFood[i]);
  }
  sendUpdates();
}

setInterval(gameloop, 1000);
setInterval(moveloop, 1000 / 60);

server.listen(config.port, () => {
  log(`[DEBUG] Listening on :${config.port}`);
});
