import global from './global';

const draw = {
  drawCircle(context, centerX, centerY, radius, sides) {
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
  },
  drawFood(context, player, food) {
    context.strokeStyle = `hsl(${food.hue}, 100%, 45%)`;
    context.fillStyle = `hsl(${food.hue}, 100%, 50%)`;
    context.lineWidth = 0;

    draw.drawCircle(
      food.x - player.x + global.screenWidth / 2,
      food.y - player.y + global.screenHeight / 2,
      food.radius, global.foodSides,
    );
  },
  drawVirus(context, player, virus) {
    context.strokeStyle = virus.stroke;
    context.fillStyle = virus.fill;
    context.lineWidth = virus.strokeWidth;

    draw.drawCircle(
      virus.x - player.x + global.screenWidth / 2,
      virus.y - player.y + global.screenHeight / 2,
      virus.radius, global.virusSides,
    );
  },
  drawFireFood(context, player, mass, border) {
    context.strokeStyle = `hsl(${mass.hue}, 100%, 45%)`;
    context.fillStyle = `hsl(${mass.hue}, 100%, 50%)`;
    context.lineWidth = border + 10;
    draw.drawCircle(
      mass.x - player.x + global.screenWidth / 2,
      mass.y - player.y + global.screenHeight / 2,
      mass.radius - 5, 18 + (~~(mass.masa / 5)),
    );
  },
  drawGrid(context, player, x, y) {
    context.save();
    context.strokeStyle = global.lineColor;
    context.lineWidth = 0.5;

    for (let i = global.xoffset - player.x; i < global.screenWidth; i += global.screenHeight / x) {
      context.moveTo(i, 0);
      context.lineTo(i, global.screenHeight);
    }

    for (let j = global.yoffset - player.y; j < global.screenHeight; j += global.screenHeight / y) {
      context.moveTo(0, j);
      context.lineTo(global.screenWidth, j);
    }

    context.stroke();
    context.restore();
  },
};

module.exports = draw;
