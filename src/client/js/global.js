module.exports = {
  // Keys and other mathematical constants
  KEY_ESC: 27,
  KEY_ENTER: 13,
  KEY_CHAT: 13,
  KEY_FIREFOOD: 119,
  KEY_SPLIT: 32,
  KEY_LEFT: 37,
  KEY_UP: 38,
  KEY_RIGHT: 39,
  KEY_DOWN: 40,

  // Game
  visibleBorder: true,
  visibleMass: true,
  spin: -Math.PI,
  enemySpin: -Math.PI,
  mobile: false,
  foodSides: 10,
  virusSides: 20,
  darkMode: true,

  // Canvas
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  gameWidth: 0,
  gameHeight: 0,
  xoffset: -1000,
  yoffset: -500,
  gameStart: false,
  disconnected: false,
  died: false,
  kicked: false,
  continuity: false,
  lightBGColor: '#f2fbff',
  darkBGColor: '#444c54',
  lineColor: 'lightgray',
  scale: 1,

  // fps
  visibleFps: true,
  startFpsTime: 0,
  lastFpsUpdateTime: 0,
  lastFpsUpdate: 0,
  fpsUpdateFrequency: 500,

  // ping
  visiblePing: true,
  startPingTime: 0,
  lastPingUpdateTime: 0,
  lastPingUpdate: 0,
  pingUpdateFrequency: 1000,
};
