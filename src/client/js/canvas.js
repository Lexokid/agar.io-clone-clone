const global = require('./global');

class Canvas {
  constructor(canvasId) {
    this.directionLock = false;
    this.target = global.target;
    this.reenviar = true;
    this.socket = global.socket;
    this.directions = [];
    const self = this;

    this.cvs = document.getElementById(canvasId);
    this.cvs.width = global.screenWidth;
    this.cvs.height = global.screenHeight;
    this.cvs.addEventListener('mousemove', this.gameInput);
    // this.cvs.addEventListener('mouseout', this.outOfBounds);
    this.cvs.addEventListener('keypress', this.keyInput);
    this.cvs.addEventListener('keyup', (event) => {
      this.reenviar = true;
      this.directionUp(event);
    });
    this.cvs.addEventListener('keydown', this.directionDown);
    this.cvs.addEventListener('touchstart', this.touchInput);
    this.cvs.addEventListener('touchmove', this.touchInput);
    this.cvs.addEventListener('mousewheel', this.wheel);
    this.cvs.parent = self;
    this.context = this.cvs.getContext('2d');
    global.canvas = this;
  }

  // Function called when a key is pressed, will change direction if arrow key.
  directionDown(event) {
    const key = event.which || event.keyCode;
    const self = this.parent; // have to do this so we are not using the cvs object
    if (self.directional(key)) {
      self.directionLock = true;
      if (self.newDirection(key, self.directions, true)) {
        self.updateTarget(self.directions);
        self.socket.emit('0', self.target);
      }
    }
  }

  // Function called when a key is lifted, will change direction if arrow key.
  directionUp(event) {
    const key = event.which || event.keyCode;
    if (this.directional(key)) { // this == the actual class
      if (this.newDirection(key, this.directions, false)) {
        this.updateTarget(this.directions);
        if (this.directions.length === 0) this.directionLock = false;
        this.socket.emit('0', this.target);
      }
    }
  }

  // Updates the direction array including information about the new direction.
  newDirection(direction, list, isAddition) {
    let result = false;
    let found = false;
    for (let i = 0, len = list.length; i < len; i++) {
      if (list[i] === direction) {
        found = true;
        if (!isAddition) {
          result = true;
          // Removes the direction.
          list.splice(i, 1);
        }
        break;
      }
    }
    // Adds the direction.
    if (isAddition && found === false) {
      result = true;
      list.push(direction);
    }

    return result;
  }

  // Updates the target according to the directions in the directions array.
  updateTarget(list) {
    this.target = {
      x: 0,
      y: 0,
    };
    let directionHorizontal = 0;
    let directionVertical = 0;
    for (let i = 0, len = list.length; i < len; i++) {
      if (directionHorizontal === 0) {
        if (list[i] === global.KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
        else if (list[i] === global.KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
      }
      if (directionVertical === 0) {
        if (list[i] === global.KEY_UP) directionVertical -= Number.MAX_VALUE;
        else if (list[i] === global.KEY_DOWN) directionVertical += Number.MAX_VALUE;
      }
    }
    this.target.x += directionHorizontal;
    this.target.y += directionVertical;
    global.target = this.target;
  }

  directional(key) {
    return this.horizontal(key) || this.vertical(key);
  }

  horizontal(key) {
    return key === global.KEY_LEFT || key === global.KEY_RIGHT;
  }

  vertical(key) {
    return key === global.KEY_DOWN || key === global.KEY_UP;
  }

  // Register when the mouse goes off the canvas.
  // outOfBounds() {
  //   if (!global.continuity) {
  //     this.parent.target = {
  //       x: 0,
  //       y: 0,
  //     };
  //     global.target = this.parent.target;
  //   }
  // }

  gameInput(mouse) {
    if (!this.directionLock) {
      this.parent.target.x = mouse.clientX - this.width / 2;
      this.parent.target.y = mouse.clientY - this.height / 2;
      global.target = this.parent.target;
    }
  }

  touchInput(touch) {
    touch.preventDefault();
    touch.stopPropagation();
    if (!this.directionLock) {
      this.parent.target.x = touch.touches[0].clientX - this.width / 2;
      this.parent.target.y = touch.touches[0].clientY - this.height / 2;
      global.target = this.parent.target;
    }
  }

  // Chat command callback functions.
  keyInput(event) {
    const key = event.which || event.keyCode;
    if (key === global.KEY_FIREFOOD && this.parent.reenviar) {
      this.parent.socket.emit('1');
      this.parent.reenviar = false;
    } else if (key === global.KEY_SPLIT && this.parent.reenviar) {
      // document.getElementById('split_cell').play();
      this.parent.socket.emit('2');
      this.parent.reenviar = false;
    } else if (key === global.KEY_CHAT) {
      document.getElementById('chatInput').focus();
    }
  }

  wheel(event) {
    console.log(global.scale);
    if (event.wheelDelta > 0) {
      global.scale += 0.05;
    } else if (event.wheelDelta < 0) {
      global.scale -= 0.05;
    }
    global.scale = Math.round(global.scale * 100) / 100;
    if (global.scale > 2) {
      global.scale = 2;
    } else if (global.scale < 0.5) {
      global.scale = 0.5;
    }
  }
}

module.exports = Canvas;
