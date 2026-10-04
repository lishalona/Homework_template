const Engine = Matter.Engine;
const Composite = Matter.Composite;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

let engine;
let ground;

let apples = [];
let worms = [];
let particles = [];
let pendingRespawns = [];

let draggedApple = null;

let messages = [];

let basket;

let gameStartedAt;

// ----------------------------------------------------
// SETUP
// ----------------------------------------------------

function setup() {
  createCanvas(windowWidth, windowHeight);

  engine = Engine.create();

  engine.gravity.y = 1;

  textAlign(CENTER, CENTER);
  rectMode(CENTER);

  gameStartedAt = millis();

  createGround();
  createBasket();
  createOrchard();
}

// ----------------------------------------------------
// 게임판
// ----------------------------------------------------

function createGround() {
  if (ground) {
    Composite.remove(engine.world, ground);
  }

  ground = Bodies.rectangle(width / 2, height + 25, width, 50, {
    isStatic: true,
  });

  Composite.add(engine.world, ground);
}

function createBasket() {
  let basketWidth = constrain(width * 0.12, 150, 250);

  basket = {
    x: width * 0.72,
    y: height * 0.84,
    w: basketWidth,
    h: basketWidth * 0.5,
  };
}

// ----------------------------------------------------
// 사과 여러 개 생성
// ----------------------------------------------------

function createOrchard() {
  // 위치는 비율로 설정해서 화면 크기가 달라도 유지
  let appleData = [
    { x: 0.27, y: 0.27, type: "green" },
    { x: 0.48, y: 0.22, type: "green" },
    { x: 0.66, y: 0.32, type: "green" },
    { x: 0.35, y: 0.38, type: "green" },
    { x: 0.55, y: 0.35, type: "green" },
    { x: 0.74, y: 0.24, type: "green" },
    { x: 0.42, y: 0.49, type: "green" },
    { x: 0.61, y: 0.48, type: "green" },
    { x: 0.78, y: 0.42, type: "green" },
  ];

  for (let a of appleData) {
    createApple(width * a.x, height * a.y, a.type);
  }
}

function createApple(x, y, type) {
  let r = random(38, 46) * artScale();

  let body = Bodies.circle(x, y, r, {
    isStatic: true,

    restitution: 0.25,

    friction: 0.04,

    frictionAir: 0.015,
  });

  Composite.add(engine.world, body);

  apples.push({
    body: body,

    homeX: x,
    homeY: y,
    homeXRatio: x / width,
    homeYRatio: y / height,

    r: r,

    type: type,

    rotten: false,

    detached: false,

    removed: false,

    alpha: 255,

    scale: 1,

    createdAt: millis(),

    ripenAt: type === "green" ? millis() + random(5000, 8000) : 0,
    wormTime: 0,

    wormComing: false,

    rotStart: 0,

    basketStartedAt: 0,

    dragStartX: 0,

    dragStartY: 0,

    wasDragged: false,

    falling: false,

    fallLandedAt: 0,
  });
}

// ----------------------------------------------------
// DRAW
// ----------------------------------------------------

function draw() {
  Engine.update(engine);

  drawSky();

  drawTree();

  updateApples();

  drawApples();

  updateWorms();
  drawWorms();

  drawBasket();

  updateParticles();

  drawMessages();
}

// ----------------------------------------------------
// 하늘
// ----------------------------------------------------

function drawSky() {
  background(244, 237, 223);
}

// ----------------------------------------------------
// 사과나무
// ----------------------------------------------------

function drawTree() {
  strokeCap(ROUND);

  noStroke();
  fill(89, 74, 53, 22);
  ellipse(width * 0.51, height * 0.885, width * 0.16, height * 0.022);

  fill(104, 72, 49);
  beginShape();
  vertex(width * 0.46, height * 0.88);
  bezierVertex(
    width * 0.47,
    height * 0.75,
    width * 0.49,
    height * 0.58,
    width * 0.485,
    height * 0.43,
  );
  vertex(width * 0.535, height * 0.43);
  bezierVertex(
    width * 0.53,
    height * 0.59,
    width * 0.54,
    height * 0.76,
    width * 0.56,
    height * 0.88,
  );
  endShape(CLOSE);

  // ----------------------------------------
  // 큰 잎 덩어리
  // ----------------------------------------

  noStroke();

  fill(48, 108, 60);
  ellipse(width * 0.53, height * 0.34, width * 0.62, height * 0.42);

  canopyBlob(0.31, 0.28, 330, 230, 47, 105, 57);

  canopyBlob(0.47, 0.21, 360, 250, 49, 109, 60);

  canopyBlob(0.63, 0.25, 390, 260, 46, 103, 57);

  canopyBlob(0.76, 0.31, 330, 250, 51, 113, 62);

  canopyBlob(0.4, 0.42, 380, 270, 48, 108, 59);

  canopyBlob(0.6, 0.43, 410, 280, 50, 110, 61);

  // 밝은 수관 레이어
  canopyBlob(0.43, 0.27, 260, 180, 65, 124, 68, 85);

  canopyBlob(0.68, 0.34, 250, 180, 68, 128, 71, 75);
}

function canopyBlob(px, py, w, h, r, g, b, a = 255) {
  noStroke();

  fill(r, g, b, a);

  ellipse(width * px, height * py, w * artScale(), h * artScale());
}

function artScale() {
  return constrain(min(width / 1440, height / 900), 0.48, 1.05);
}

// ----------------------------------------------------
// 사과 업데이트
// ----------------------------------------------------

function updateApples() {
  for (let i = pendingRespawns.length - 1; i >= 0; i--) {
    let respawn = pendingRespawns[i];

    if (millis() >= respawn.at) {
      createApple(respawn.xRatio * width, respawn.yRatio * height, "green");

      pendingRespawns.splice(i, 1);
    }
  }

  for (let i = apples.length - 1; i >= 0; i--) {
    let a = apples[i];

    if (a.removed) {
      continue;
    }

    if (a.falling) {
      let p = a.body.position;

      if (!a.fallLandedAt && p.y >= height - a.r) {
        a.fallLandedAt = millis();

        Body.setStatic(a.body, true);
        Body.setPosition(a.body, {
          x: p.x,
          y: height - a.r,
        });
      }

      if (a.fallLandedAt) {
        let t = constrain((millis() - a.fallLandedAt) / 650, 0, 1);

        a.alpha = lerp(255, 0, t);
        a.scale = lerp(1, 0.15, t);

        if (t >= 1) {
          removeApple(a);

          continue;
        }
      }

      continue;
    }

    if (a.type === "green" && millis() >= a.ripenAt) {
      a.type = "red";

      a.wormTime = millis() + random(6500, 11000);
    }

    // 빨간 사과는 오래 방치하면 벌레 출발
    if (
      a.type === "red" &&
      !a.detached &&
      !a.rotten &&
      !a.wormComing &&
      millis() > a.wormTime
    ) {
      // 화면 너무 복잡해지는 것 방지
      if (worms.length < 2) {
        createWorm(a);

        a.wormComing = true;
      }
    }

    // 썩은 사과 사라지기
    if (a.rotten) {
      let t = (millis() - a.rotStart) / 1500;

      t = constrain(t, 0, 1);

      a.scale = lerp(1, 0.15, t);

      a.alpha = lerp(255, 0, t);

      if (t >= 1) {
        removeApple(a);
      }
    }

    if (a.basketStartedAt) {
      let elapsed = millis() - a.basketStartedAt;
      let aboveBasketY = basket.y - basket.h * 0.48;
      let travelT = constrain(elapsed / 850, 0, 1);
      let easedTravelT = 1 - pow(1 - travelT, 3);

      if (elapsed < 850) {
        Body.setPosition(a.body, {
          x: lerp(a.basketStartX, basket.x, easedTravelT),
          y: lerp(a.basketStartY, aboveBasketY, easedTravelT),
        });
      } else {
        let dropT = constrain((elapsed - 850) / 450, 0, 1);

        Body.setPosition(a.body, {
          x: basket.x,
          y: lerp(aboveBasketY, basket.y, dropT),
        });

        if (dropT >= 1) {
          showMessage(basket.x, basket.y - 100, "PERFECT!", 1000);

          createParticles(basket.x, basket.y, "red");

          removeApple(a);

          continue;
        }
      }
    }

    // 바구니 체크
    if (a.detached && !a.rotten && !a.basketStartedAt) {
      checkAppleBasket(a);
    }
  }
}

// ----------------------------------------------------
// 사과 그리기
// ----------------------------------------------------

function drawApples() {
  for (let a of apples) {
    if (a.removed) {
      continue;
    }

    drawApple(a);
  }
}

function drawApple(a) {
  let p = a.body.position;

  push();

  translate(p.x, p.y);

  scale(a.scale);

  let skinColor;
  let edgeColor;

  if (a.rotten) {
    skinColor = color(132, 91, 58, a.alpha);
    edgeColor = color(86, 65, 45, a.alpha);
  } else if (a.type === "green") {
    skinColor = color(155, 190, 77, a.alpha);
    edgeColor = color(94, 132, 56, a.alpha);
  } else {
    skinColor = color(202, 70, 58, a.alpha);
    edgeColor = color(133, 54, 49, a.alpha);
  }

  noStroke();
  fill(54, 73, 44, a.alpha * 0.22);
  ellipse(3, a.r * 0.68, a.r * 1.55, a.r * 0.36);

  stroke(edgeColor);
  strokeWeight(max(1, a.r * 0.035));
  fill(skinColor);
  beginShape();
  vertex(0, -a.r * 0.67);
  bezierVertex(
    -a.r * 0.28,
    -a.r * 1.02,
    -a.r * 0.84,
    -a.r * 0.8,
    -a.r * 0.98,
    -a.r * 0.18,
  );
  bezierVertex(-a.r * 1.1, a.r * 0.42, -a.r * 0.54, a.r * 0.9, 0, a.r * 0.8);
  bezierVertex(
    a.r * 0.54,
    a.r * 0.9,
    a.r * 1.1,
    a.r * 0.42,
    a.r * 0.98,
    -a.r * 0.18,
  );
  bezierVertex(a.r * 0.84, -a.r * 0.8, a.r * 0.28, -a.r * 1.02, 0, -a.r * 0.67);
  endShape(CLOSE);

  noStroke();
  if (a.rotten) {
    fill(67, 59, 40, a.alpha * 0.8);
    ellipse(a.r * 0.34, -a.r * 0.12, a.r * 0.42, a.r * 0.28);
    ellipse(-a.r * 0.3, a.r * 0.28, a.r * 0.3, a.r * 0.22);
  } else {
    fill(
      a.type === "green" ? color(209, 224, 126, 120) : color(246, 130, 93, 100),
    );
    ellipse(-a.r * 0.29, -a.r * 0.16, a.r * 0.68, a.r * 0.9);
    fill(255, 244, 209, a.alpha * 0.72);
    ellipse(-a.r * 0.4, -a.r * 0.34, a.r * 0.18, a.r * 0.38);
    fill(a.type === "green" ? color(92, 132, 54, 70) : color(124, 43, 46, 65));
    ellipse(a.r * 0.36, a.r * 0.22, a.r * 0.55, a.r * 0.66);
  }

  // 꼭지
  if (!a.detached) {
    stroke(78, 56, 39, a.alpha);
    strokeWeight(max(2, a.r * 0.1));
    strokeCap(ROUND);
    line(0, -a.r * 0.68, a.r * 0.08, -a.r * 1.03);

    noStroke();
    fill(89, 133, 64, a.alpha);
    push();
    translate(a.r * 0.13, -a.r * 0.9);
    rotate(-0.45);
    ellipse(0, 0, a.r * 0.48, a.r * 0.2);
    pop();
  }

  pop();
}

// ----------------------------------------------------
// 벌레
// ----------------------------------------------------

function createWorm(targetApple) {
  let target = targetApple.body.position;
  let approachAngle = random(TWO_PI);
  let distance = targetApple.r + random(55, 95);
  let startX = target.x + cos(approachAngle) * distance;
  let startY = target.y + sin(approachAngle) * distance;
  let canopyX = width * 0.53;
  let canopyY = height * 0.32;
  let offsetX = (startX - canopyX) / (width * 0.42);
  let offsetY = (startY - canopyY) / (height * 0.27);
  let canopyDistance = sqrt(offsetX * offsetX + offsetY * offsetY);

  if (canopyDistance > 0.94) {
    startX = canopyX + (offsetX / canopyDistance) * width * 0.42 * 0.94;
    startY = canopyY + (offsetY / canopyDistance) * height * 0.27 * 0.94;
  }

  worms.push({
    x: startX,
    y: startY,

    target: targetApple,

    angle: atan2(target.y - startY, target.x - startX),

    speed: random(1.3, 1.8),
  });
}

function updateWorms() {
  for (let i = worms.length - 1; i >= 0; i--) {
    let w = worms[i];

    let a = w.target;

    if (!a || a.removed || a.detached || a.rotten) {
      worms.splice(i, 1);

      continue;
    }

    let p = a.body.position;

    let dx = p.x - w.x;

    let dy = p.y - w.y;

    let len = sqrt(dx * dx + dy * dy);

    if (len > 0) {
      w.angle = atan2(dy, dx);

      w.x += (dx / len) * w.speed;

      w.y += (dy / len) * w.speed;
    }

    // 닿음
    if (len < a.r + 12) {
      a.rotten = true;

      a.rotStart = millis();

      showMessage(p.x, p.y - 75, "TOO LATE!", 1700);

      worms.splice(i, 1);
    }
  }
}

function drawWorms() {
  for (let w of worms) {
    push();

    translate(w.x, w.y);

    rotate(w.angle);

    noStroke();

    fill(230, 153, 70);

    for (let i = 0; i < 5; i++) {
      let yy = sin(frameCount * 0.1 + i * 0.8) * 2.5;

      ellipse(i * 10 - 21, yy, 18, 16);
    }

    fill(195, 110, 54);

    ellipse(30, 0, 20, 19);

    fill(25);

    ellipse(34, -4, 3, 3);

    pop();
  }
}

// ----------------------------------------------------
// 바구니
// ----------------------------------------------------

function drawBasket() {
  let s = artScale();

  push();

  translate(basket.x, basket.y);

  noStroke();
  fill(54, 67, 47, 45);
  ellipse(0, basket.h * 0.46, basket.w * 1.05, basket.h * 0.24);

  noFill();
  stroke(104, 69, 47);
  strokeWeight(8 * s);
  arc(0, -basket.h * 0.2, basket.w * 0.68, basket.h * 1.05, PI, TWO_PI);
  stroke(209, 157, 98, 180);
  strokeWeight(2 * s);
  arc(0, -basket.h * 0.2, basket.w * 0.63, basket.h * 0.96, PI, TWO_PI);

  fill(173, 112, 65);
  stroke(105, 69, 48);
  strokeWeight(3 * s);
  beginShape();
  vertex(-basket.w * 0.5, -basket.h * 0.2);
  bezierVertex(
    -basket.w * 0.46,
    basket.h * 0.12,
    -basket.w * 0.37,
    basket.h * 0.39,
    -basket.w * 0.31,
    basket.h * 0.44,
  );
  vertex(basket.w * 0.31, basket.h * 0.44);
  bezierVertex(
    basket.w * 0.37,
    basket.h * 0.39,
    basket.w * 0.46,
    basket.h * 0.12,
    basket.w * 0.5,
    -basket.h * 0.2,
  );
  endShape(CLOSE);

  stroke(224, 171, 111, 210);
  strokeWeight(3 * s);
  for (let i = -2; i <= 2; i++) {
    let x = i * basket.w * 0.13;
    bezier(
      x,
      -basket.h * 0.08,
      x - 4 * s,
      basket.h * 0.1,
      x * 0.86,
      basket.h * 0.31,
      x * 0.78,
      basket.h * 0.39,
    );
  }

  stroke(125, 77, 48, 190);
  strokeWeight(2.5 * s);
  for (let row = 0; row < 3; row++) {
    let y = basket.h * (row * 0.13 + 0.02);
    let span = basket.w * (0.45 - row * 0.045);
    bezier(-span, y, -span * 0.35, y + 5 * s, span * 0.35, y + 5 * s, span, y);
  }

  noFill();
  stroke(226, 173, 111);
  strokeWeight(7 * s);
  bezier(
    -basket.w * 0.5,
    -basket.h * 0.2,
    -basket.w * 0.25,
    -basket.h * 0.15,
    basket.w * 0.25,
    -basket.h * 0.15,
    basket.w * 0.5,
    -basket.h * 0.2,
  );

  pop();
}

// ----------------------------------------------------
// 입력
// ----------------------------------------------------

function mousePressed() {
  // 뒤에서부터 검사
  // 화면상 앞에 있는 사과 우선

  for (let i = apples.length - 1; i >= 0; i--) {
    let a = apples[i];

    if (a.removed || a.rotten || a.detached) {
      continue;
    }

    let p = a.body.position;

    let d = dist(mouseX, mouseY, p.x, p.y);

    if (d < a.r + 12) {
      // --------------------------------
      // GREEN
      // 한 번 클릭 -> 즉시 삭제
      // --------------------------------

      if (a.type === "green") {
        showMessage(p.x, p.y - 70, "TOO EARLY!", 1000);

        createParticles(p.x, p.y, "green");

        removeApple(a);

        return;
      }

      // --------------------------------
      // RED
      // 드래그 가능
      // --------------------------------

      if (a.type === "red") {
        draggedApple = a;
        a.dragStartX = p.x;
        a.dragStartY = p.y;
        a.wasDragged = false;

        return;
      }
    }
  }
}

function mouseDragged() {
  if (!draggedApple) {
    return;
  }

  if (
    dist(mouseX, mouseY, draggedApple.dragStartX, draggedApple.dragStartY) > 8
  ) {
    draggedApple.wasDragged = true;
  }

  Body.setPosition(draggedApple.body, {
    x: mouseX,
    y: mouseY,
  });
}

function mouseReleased() {
  if (!draggedApple) {
    return;
  }

  let a = draggedApple;

  let p = a.body.position;

  draggedApple = null;

  if (!a.wasDragged) {
    Body.setPosition(a.body, {
      x: a.dragStartX,
      y: a.dragStartY,
    });

    return;
  }

  a.detached = true;

  if (dist(p.x, p.y, basket.x, basket.y) <= basket.w * 1.3 + a.r * 1.5) {
    a.basketStartX = p.x;

    a.basketStartY = p.y;

    a.basketStartedAt = millis();
  } else {
    a.falling = true;

    showMessage(p.x, p.y - 55, "NOT THERE!", 1400);

    Body.setStatic(a.body, false);
    Body.setVelocity(a.body, {
      x: random(-0.6, 0.6),
      y: 1.5,
    });
    Body.setAngularVelocity(a.body, random(-0.04, 0.04));
  }
}

// ----------------------------------------------------
// 바구니 충돌
// ----------------------------------------------------

function checkAppleBasket(a) {
  let p = a.body.position;

  let insideX = p.x > basket.x - basket.w / 2 && p.x < basket.x + basket.w / 2;

  let insideY = p.y > basket.y - basket.h * 0.8;

  if (insideX && insideY) {
    showMessage(basket.x, basket.y - 100, "PERFECT!", 1000);

    createParticles(p.x, p.y, "red");

    removeApple(a);
  }
}

// ----------------------------------------------------
// 사과 삭제
// ----------------------------------------------------

function removeApple(a) {
  if (!a || a.removed) {
    return;
  }

  Composite.remove(engine.world, a.body);

  a.removed = true;

  pendingRespawns.push({
    xRatio: a.homeXRatio,
    yRatio: a.homeYRatio,
    at: millis() + 900,
  });

  apples.splice(apples.indexOf(a), 1);
}

// ----------------------------------------------------
// 파티클
// ----------------------------------------------------

function createParticles(x, y, type) {
  for (let i = 0; i < 14; i++) {
    particles.push({
      x: x,
      y: y,

      vx: random(-2.5, 2.5),

      vy: random(-3.5, 0),

      life: 255,

      type: type,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    p.x += p.vx;
    p.y += p.vy;

    p.vy += 0.07;

    p.life -= 7;

    noStroke();

    if (p.type === "green") {
      fill(151, 191, 70, p.life);
    } else {
      fill(211, 56, 45, p.life);
    }

    ellipse(p.x, p.y, 8, 5);

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ----------------------------------------------------
// 메시지
// ----------------------------------------------------

function showMessage(x, y, textValue, duration) {
  messages.push({
    x: x,
    y: y,

    text: textValue,

    start: millis(),

    duration: duration,
  });
}

function drawMessages() {
  for (let i = messages.length - 1; i >= 0; i--) {
    let m = messages[i];

    let elapsed = millis() - m.start;

    if (elapsed > m.duration) {
      messages.splice(i, 1);

      continue;
    }

    let alpha = map(elapsed, 0, m.duration, 255, 0);

    let yOffset = map(elapsed, 0, m.duration, 0, -22);

    push();

    textSize(21);

    textStyle(BOLD);

    fill(255, alpha);

    stroke(72, 57, 36, alpha * 0.35);

    strokeWeight(3);

    text(m.text, m.x, m.y + yOffset);

    pop();
  }
}

// ----------------------------------------------------
// RESIZE
// ----------------------------------------------------

function windowResized() {
  let nextWidth = window.innerWidth;
  let nextHeight = window.innerHeight;
  let scaleX = nextWidth / width;
  let scaleY = nextHeight / height;

  resizeCanvas(nextWidth, nextHeight);

  for (let a of apples) {
    let p = a.body.position;

    Body.setPosition(a.body, {
      x: p.x * scaleX,
      y: p.y * scaleY,
    });

    a.homeX = a.homeXRatio * width;
    a.homeY = a.homeYRatio * height;
    a.dragStartX *= scaleX;
    a.dragStartY *= scaleY;

    if (a.basketStartedAt) {
      a.basketStartX *= scaleX;
      a.basketStartY *= scaleY;
    }
  }

  for (let worm of worms) {
    worm.x *= scaleX;
    worm.y *= scaleY;
  }

  createBasket();
  createGround();
}
