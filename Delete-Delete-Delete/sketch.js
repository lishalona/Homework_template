let baseLeaves = [];
let fillLeaves = [];
let midLeaves = [];
let frontLeaves = [];
let edgePoints = [];

let apples = [];
let worms = [];
let messages = [];
let sparkleParticles = [];

const bgColor = "#F7F7F3";

// -------------------------------------------------
// 시간
// -------------------------------------------------

const GREEN_TIME = 3000; // 풋사과 → 빨간사과
const RED_SAFE_TIME = 7000; // 빨간사과가 된 뒤 벌레 나오기 전 시간

const TARGET_APPLE_COUNT = 9;

// -------------------------------------------------
// 잎 색
// -------------------------------------------------

const basePalette = ["#123D26", "#16462A", "#1A4F2E", "#1F5832"];

const fillPalette = ["#16472A", "#1A512E", "#205B33", "#266638"];

const midPalette = ["#205B33", "#266638", "#2D703D", "#357A42"];

const frontPalette = ["#255F35", "#2D6A39", "#36753E", "#3F8144", "#4A8C49"];

// =================================================
// SETUP
// =================================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  noStroke();

  generateScene();
}

// =================================================
// DRAW
// =================================================

function draw() {
  background(bgColor);

  // --------------------------------
  // 나무
  // --------------------------------

  drawLeaves(baseLeaves, false);

  drawLeaves(fillLeaves, false);

  drawLeaves(midLeaves, false);

  drawLeaves(frontLeaves, true);

  // --------------------------------
  // 인터랙션
  // --------------------------------

  updateApples();

  updateWorms();

  // --------------------------------
  // 벌레
  // --------------------------------

  drawWorms();

  // --------------------------------
  // 사과
  // --------------------------------

  updateParticles();

  drawParticles();

  drawApples();

  // --------------------------------
  // 바구니
  // --------------------------------

  drawBasket();

  // --------------------------------
  // 메시지
  // --------------------------------

  drawMessages();
}

// =================================================
// RESIZE
// =================================================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  generateScene();
}

// =================================================
// 전체 생성
// =================================================

function generateScene() {
  baseLeaves = [];
  fillLeaves = [];
  midLeaves = [];
  frontLeaves = [];
  edgePoints = [];

  apples = [];
  worms = [];
  messages = [];
  sparkleParticles = [];

  generateEdge();

  createBaseLeaves();
  createFillLeaves();
  createMidLeaves();
  createFrontLeaves();

  createApples();
}

// =================================================
// 나무 아래 경계
// =================================================

function generateEdge() {
  let step = 64;

  let currentY = height * 0.4;

  for (let x = -100; x <= width + 100; x += step) {
    currentY += random(-8, 8);

    currentY = constrain(currentY, height * 0.34, height * 0.46);

    let extraDrop = 0;

    if (random() < 0.22) {
      extraDrop = random(16, 42);
    }

    edgePoints.push({
      x: x,

      y: currentY + extraDrop,
    });
  }
}

function getEdgeY(x) {
  if (edgePoints.length === 0) {
    return height * 0.4;
  }

  for (let i = 0; i < edgePoints.length - 1; i++) {
    let a = edgePoints[i];

    let b = edgePoints[i + 1];

    if (x >= a.x && x <= b.x) {
      let t = (x - a.x) / (b.x - a.x);

      return lerp(a.y, b.y, t);
    }
  }

  return edgePoints[edgePoints.length - 1].y;
}

// =================================================
// 뒤쪽 큰 잎
// =================================================

function createBaseLeaves() {
  let rowGap = 66;

  let colGap = 78;

  for (let y = -120; y < height * 0.55; y += rowGap) {
    let rowIndex = floor((y + 120) / rowGap);

    let offset = rowIndex % 2 === 0 ? 0 : colGap * 0.5;

    for (let x = -80 + offset; x < width + 80; x += colGap) {
      let edgeY = getEdgeY(x);

      if (y < edgeY - 28) {
        baseLeaves.push(
          createLeafData(
            x + random(-10, 10),

            y + random(-8, 8),

            random(145, 210),

            random(-24, 24),

            random(basePalette),

            random(TWO_PI),

            random(0.006, 0.011),

            random(0.4, 0.9),
          ),
        );
      }
    }
  }

  for (let x = -50; x < width + 50; x += 60) {
    let edgeY = getEdgeY(x);

    baseLeaves.push(
      createLeafData(
        x + random(-8, 8),

        edgeY - random(28, 62),

        random(135, 190),

        random(-22, 22),

        random(basePalette),

        random(TWO_PI),

        random(0.006, 0.011),

        random(0.4, 0.9),
      ),
    );
  }
}

// =================================================
// 여백 메우는 잎
// =================================================

function createFillLeaves() {
  let rowGap = 44;

  let colGap = 54;

  for (let y = -95; y < height * 0.58; y += rowGap) {
    let rowIndex = floor((y + 95) / rowGap);

    let offset = rowIndex % 2 === 0 ? colGap * 0.25 : colGap * 0.75;

    for (let x = -60 + offset; x < width + 60; x += colGap) {
      let edgeY = getEdgeY(x);

      if (y < edgeY - 18) {
        fillLeaves.push(
          createLeafData(
            x + random(-10, 10),

            y + random(-8, 8),

            random(88, 128),

            random(-26, 26),

            random(fillPalette),

            random(TWO_PI),

            random(0.007, 0.013),

            random(0.5, 1.2),
          ),
        );

        if (random() < 0.26) {
          fillLeaves.push(
            createLeafData(
              x + random(-12, 12),

              y + random(-10, 10),

              random(82, 120),

              random(-28, 28),

              random(fillPalette),

              random(TWO_PI),

              random(0.007, 0.013),

              random(0.5, 1.2),
            ),
          );
        }
      }
    }
  }

  for (let x = -30; x < width + 30; x += 40) {
    let edgeY = getEdgeY(x);

    fillLeaves.push(
      createLeafData(
        x + random(-7, 7),

        edgeY - random(18, 42),

        random(84, 124),

        random(-22, 22),

        random(fillPalette),

        random(TWO_PI),

        random(0.007, 0.013),

        random(0.5, 1.2),
      ),
    );
  }
}

// =================================================
// 중간 잎
// =================================================

function createMidLeaves() {
  let rowGap = 58;

  let colGap = 72;

  for (let y = -50; y < height * 0.52; y += rowGap) {
    let rowIndex = floor((y + 50) / rowGap);

    let offset = rowIndex % 2 === 0 ? colGap * 0.15 : colGap * 0.6;

    for (let x = -50 + offset; x < width + 50; x += colGap) {
      let edgeY = getEdgeY(x);

      if (y < edgeY - 12) {
        midLeaves.push(
          createLeafData(
            x + random(-10, 10),

            y + random(-8, 8),

            random(92, 138),

            random(-28, 28),

            random(midPalette),

            random(TWO_PI),

            random(0.008, 0.014),

            random(0.6, 1.4),
          ),
        );
      }
    }
  }
}

// =================================================
// 앞쪽 잎
// =================================================

function createFrontLeaves() {
  let rowGap = 76;

  let colGap = 92;

  for (let y = -10; y < height * 0.48; y += rowGap) {
    let rowIndex = floor((y + 10) / rowGap);

    let offset = rowIndex % 2 === 0 ? colGap * 0.2 : colGap * 0.65;

    for (let x = -40 + offset; x < width + 40; x += colGap) {
      let edgeY = getEdgeY(x);

      if (y < edgeY - 10) {
        frontLeaves.push(
          createLeafData(
            x + random(-10, 10),

            y + random(-10, 10),

            random(108, 170),

            random(-30, 30),

            pickFrontColor(),

            random(TWO_PI),

            random(0.009, 0.017),

            random(0.8, 1.8),
          ),
        );
      }
    }
  }

  for (let x = -20; x < width + 20; x += 58) {
    let edgeY = getEdgeY(x);

    frontLeaves.push(
      createLeafData(
        x + random(-8, 8),

        edgeY - random(4, 16),

        random(92, 148),

        random(-24, 24),

        pickFrontColor(),

        random(TWO_PI),

        random(0.009, 0.017),

        random(0.8, 1.8),
      ),
    );
  }
}

// =================================================
// 사과 처음 생성
// =================================================

function createApples() {
  apples = [];

  for (let i = 0; i < TARGET_APPLE_COUNT; i++) {
    addNewApple();
  }
}

// =================================================
// 새 사과
// =================================================

function addNewApple() {
  let attempts = 0;

  while (attempts < 200) {
    attempts++;

    let x = random(width * 0.07, width * 0.93);

    let edgeY = getEdgeY(x);

    let y = random(height * 0.06, edgeY - 75);

    let size = random(56, 74);

    let valid = true;

    for (let apple of apples) {
      if (apple.removed) {
        continue;
      }

      let d = dist(x, y, apple.x, apple.y);

      if (d < 125) {
        valid = false;

        break;
      }
    }

    if (!valid) {
      continue;
    }

    apples.push({
      // --------------------------------
      // 기존 그래픽
      // --------------------------------

      x: x,

      y: y,

      homeX: x,

      homeY: y,

      size: size,

      phase: random(TWO_PI),

      swaySpeed: random(0.012, 0.02),

      swayAmount: random(1.2, 2.4),

      rotation: random(-5, 5),

      // --------------------------------
      // 상태
      // --------------------------------

      state: "green",

      bornTime: millis(),

      redTime: null,

      wormCreated: false,

      // --------------------------------
      // 드래그
      // --------------------------------

      dragging: false,

      dragOffsetX: 0,

      dragOffsetY: 0,

      dragStartX: 0,

      dragStartY: 0,

      wasDragged: false,

      // --------------------------------
      // 제거
      // --------------------------------

      removed: false,

      // --------------------------------
      // 잘못 놓았을 때
      // --------------------------------

      falling: false,

      fallVelocity: 0,

      alpha: 255,

      scale: 1,

      // --------------------------------
      // 바구니 이동
      // --------------------------------

      basketMoving: false,

      basketMoveStart: 0,

      basketStartX: 0,

      basketStartY: 0,

      // --------------------------------
      // 썩음
      // --------------------------------

      rottenAt: null,
    });

    return;
  }
}

// =================================================
// 사과 상태 업데이트
// =================================================

function updateApples() {
  let now = millis();

  for (let apple of apples) {
    if (apple.removed) {
      continue;
    }

    if (apple.vanishing) {
      let t = constrain((now - apple.vanishStart) / apple.vanishDuration, 0, 1);

      apple.alpha = lerp(255, 0, t);

      apple.scale = lerp(1, 0.72, t);

      if (t >= 1) {
        apple.removed = true;
      }

      continue;
    }

    // --------------------------------
    // 초록 → 빨강
    // --------------------------------

    if (apple.state === "green" && now - apple.bornTime >= GREEN_TIME) {
      apple.state = "red";

      apple.redTime = now;
    }

    // --------------------------------
    // 빨간 사과
    // 3초 뒤 애벌레 생성
    // --------------------------------

    if (
      apple.state === "red" &&
      !apple.dragging &&
      !apple.falling &&
      !apple.basketMoving
    ) {
      if (!apple.wormCreated && now - apple.redTime >= RED_SAFE_TIME) {
        createWorm(apple);

        apple.wormCreated = true;
      }
    }

    // --------------------------------
    // 잘못 놓은 사과
    // 아래로 떨어짐
    // --------------------------------

    if (apple.falling) {
      apple.fallVelocity += 0.45;

      apple.y += apple.fallVelocity;

      if (apple.y >= height - apple.size * 0.45) {
        apple.y = height - apple.size * 0.45;

        apple.alpha -= 12;

        apple.scale *= 0.965;

        if (apple.alpha <= 0 || apple.scale < 0.15) {
          removeApple(apple);
        }
      }
    }

    // --------------------------------
    // 바구니로 이동
    // --------------------------------

    if (apple.basketMoving) {
      updateBasketMovement(apple);
    }

    // --------------------------------
    // 썩은 사과
    // --------------------------------

    if (apple.state === "rotten") {
      let elapsed = now - apple.rottenAt;

      let t = constrain(elapsed / 1200, 0, 1);

      apple.scale = lerp(1, 0.15, t);

      apple.alpha = lerp(255, 0, t);

      if (t >= 1) {
        removeApple(apple);
      }
    }
  }
}

// =================================================
// 애벌레 생성
// =================================================

function createWorm(apple) {
  let angle = random(TWO_PI);

  let distance = random(apple.size * 1.2, apple.size * 1.65);

  worms.push({
    x: apple.x + cos(angle) * distance,

    y: apple.y + sin(angle) * distance,

    target: apple,

    speed: random(0.45, 0.7),

    // 너무 작지 않게
    size: random(12, 16),

    phase: random(TWO_PI),

    angle: angle,
  });
}

// =================================================
// 애벌레 업데이트
// =================================================

function updateWorms() {
  for (let i = worms.length - 1; i >= 0; i--) {
    let worm = worms[i];

    let apple = worm.target;

    // --------------------------------
    // 사과를 따면 벌레 제거
    // --------------------------------

    if (
      !apple ||
      apple.removed ||
      apple.vanishing ||
      apple.dragging ||
      apple.falling ||
      apple.basketMoving ||
      apple.state !== "red"
    ) {
      worms.splice(i, 1);

      continue;
    }

    // --------------------------------
    // 목표 방향
    // --------------------------------

    let dx = apple.x - worm.x;

    let dy = apple.y - worm.y;

    let len = sqrt(dx * dx + dy * dy);

    if (len > 0) {
      worm.angle = atan2(dy, dx);

      worm.x += (dx / len) * worm.speed;

      worm.y += (dy / len) * worm.speed;

      // 아주 살짝 꿈틀
      worm.y += sin(frameCount * 0.12 + worm.phase) * 0.25;
    }

    // --------------------------------
    // 닿으면 썩음
    // --------------------------------

    if (len < apple.size * 0.48) {
      makeAppleRotten(apple);

      worms.splice(i, 1);
    }
  }
}

// =================================================
// 애벌레 그리기
// =================================================

function drawWorms() {
  for (let worm of worms) {
    push();

    translate(worm.x, worm.y);

    rotate(worm.angle);

    noStroke();

    // --------------------------------
    // 몸통
    // --------------------------------

    fill("#D8C75C");

    for (let i = 0; i < 4; i++) {
      let yy = sin(frameCount * 0.14 + i * 0.8 + worm.phase) * 1.8;

      ellipse(
        i * worm.size * 0.45 - worm.size * 0.7,

        yy,

        worm.size * 0.65,

        worm.size * 0.57,
      );
    }

    // --------------------------------
    // 머리
    // --------------------------------

    fill("#8B6A2F");

    ellipse(
      worm.size * 1.05,

      0,

      worm.size * 0.7,

      worm.size * 0.67,
    );

    // --------------------------------
    // 눈
    // --------------------------------

    fill("#241B10");

    ellipse(
      worm.size * 1.17,

      -worm.size * 0.1,

      worm.size * 0.09,

      worm.size * 0.09,
    );

    // --------------------------------
    // 더듬이
    // --------------------------------

    stroke("#5C4723");

    strokeWeight(1.1);

    line(
      worm.size * 1.12,

      -worm.size * 0.22,

      worm.size * 1.38,

      -worm.size * 0.5,
    );

    pop();
  }
}

// =================================================
// 사과 전체
// =================================================

function drawApples() {
  for (let apple of apples) {
    if (apple.removed) {
      continue;
    }

    drawApple(apple);
  }
}

function updateParticles() {
  for (let i = sparkleParticles.length - 1; i >= 0; i--) {
    let p = sparkleParticles[i];

    p.life -= 1;

    p.x += p.vx;

    p.y += p.vy;

    p.vy += 0.03;

    if (p.life <= 0) {
      sparkleParticles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (let p of sparkleParticles) {
    let alpha = (p.life / p.maxLife) * 180;

    fill(p.color[0], p.color[1], p.color[2], alpha);

    ellipse(p.x, p.y, p.size, p.size);
  }
}

function spawnAppleBurst(apple) {
  let color =
    apple.state === "rotten"
      ? [110, 74, 44]
      : apple.state === "red"
        ? [217, 74, 58]
        : [168, 209, 58];

  for (let i = 0; i < 10; i++) {
    let angle = random(TWO_PI);

    let speed = random(0.7, 2.4);

    sparkleParticles.push({
      x: apple.x + random(-apple.size * 0.2, apple.size * 0.2),

      y: apple.y + random(-apple.size * 0.2, apple.size * 0.2),

      vx: cos(angle) * speed,

      vy: sin(angle) * speed - 0.4,

      size: random(2.2, 5.4),

      life: random(18, 34),

      maxLife: 34,

      color: color,
    });
  }
}

// =================================================
// 사과 하나
// 그래픽은 기존 그대로
// =================================================

function drawApple(apple) {
  push();

  let swing = 0;

  if (!apple.dragging && !apple.falling && !apple.basketMoving) {
    swing = sin(frameCount * apple.swaySpeed + apple.phase) * apple.swayAmount;
  }

  let alphaValue = apple.alpha ?? 255;

  if (apple.vanishing) {
    let t = constrain(
      (millis() - apple.vanishStart) / apple.vanishDuration,
      0,
      1,
    );

    alphaValue = lerp(255, 0, t);

    apple.scale = lerp(1, 0.72, t);
  }

  translate(apple.x, apple.y);

  rotate(radians(apple.rotation + swing));

  scale(apple.scale);

  let s = apple.size;

  // 그림자

  fill(0, 0, 0, 25 * (alphaValue / 255));

  ellipse(0, s * 0.08, s * 0.92, s * 0.88);

  // 꼭지

  stroke(90, 65, 39, alphaValue);

  strokeWeight(s * 0.08);

  line(
    0,
    -s * 0.42,

    s * 0.04,
    -s * 0.67,
  );

  noStroke();

  // 잎

  push();

  translate(s * 0.1, -s * 0.57);

  rotate(radians(35));

  fill(77, 143, 61, alphaValue);

  ellipse(0, 0, s * 0.28, s * 0.13);

  pop();

  // --------------------------------
  // 사과 색
  // --------------------------------

  if (apple.state === "green") {
    fill(168, 209, 58, alphaValue);
  }

  if (apple.state === "red") {
    fill(217, 74, 58, alphaValue);
  }

  if (apple.state === "rotten") {
    fill(110, 74, 44, alphaValue);
  }

  // --------------------------------
  // 본체
  // --------------------------------

  beginShape();

  vertex(0, -s * 0.34);

  bezierVertex(
    s * 0.13,
    -s * 0.43,

    s * 0.43,
    -s * 0.34,

    s * 0.46,
    -s * 0.05,
  );

  bezierVertex(
    s * 0.49,
    s * 0.25,

    s * 0.27,
    s * 0.46,

    0,
    s * 0.48,
  );

  bezierVertex(
    -s * 0.27,
    s * 0.46,

    -s * 0.49,
    s * 0.25,

    -s * 0.46,
    -s * 0.05,
  );

  bezierVertex(
    -s * 0.43,
    -s * 0.34,

    -s * 0.13,
    -s * 0.43,

    0,
    -s * 0.34,
  );

  endShape(CLOSE);

  // --------------------------------
  // 썩은 반점
  // --------------------------------

  if (apple.state === "rotten") {
    fill(54, 34, 20, alphaValue * 0.75);

    ellipse(
      -s * 0.17,
      s * 0.04,

      s * 0.18,
      s * 0.13,
    );

    ellipse(
      s * 0.18,
      s * 0.15,

      s * 0.22,
      s * 0.17,
    );

    ellipse(
      s * 0.05,
      -s * 0.16,

      s * 0.12,
      s * 0.09,
    );
  }

  // --------------------------------
  // 하이라이트
  // --------------------------------

  if (apple.state !== "rotten") {
    fill(255, 255, 255, 85 * (alphaValue / 255));

    ellipse(
      -s * 0.17,
      -s * 0.12,

      s * 0.1,
      s * 0.18,
    );

    fill(255, 255, 255, 25 * (alphaValue / 255));

    ellipse(
      -s * 0.05,
      -s * 0.03,

      s * 0.45,
      s * 0.55,
    );
  }

  pop();
}

// =================================================
// 썩은 사과
// =================================================

function makeAppleRotten(apple) {
  if (apple.state !== "red") {
    return;
  }

  apple.state = "rotten";

  apple.rottenAt = millis();

  removeWormForApple(apple);

  showMessage(
    apple.x,

    apple.y + apple.size * 0.9,

    "TOO LATE!",

    1200,
  );
}

// =================================================
// 마우스 시작
// =================================================

function mousePressed() {
  startAppleInteraction(mouseX, mouseY);
}

// =================================================
// 마우스 드래그
// =================================================

function mouseDragged() {
  moveAppleInteraction(mouseX, mouseY);
}

// =================================================
// 마우스 끝
// =================================================

function mouseReleased() {
  endAppleInteraction();
}

// =================================================
// 클릭 / 터치 시작
// =================================================

function startAppleInteraction(px, py) {
  for (let i = apples.length - 1; i >= 0; i--) {
    let apple = apples[i];

    if (
      apple.removed ||
      apple.vanishing ||
      apple.falling ||
      apple.basketMoving ||
      apple.state === "rotten"
    ) {
      continue;
    }

    let d = dist(
      px,
      py,

      apple.x,
      apple.y,
    );

    if (d > apple.size * 0.6) {
      continue;
    }

    // --------------------------------
    // 풋사과
    // --------------------------------

    if (apple.state === "green") {
      showMessage(
        apple.x,

        apple.y + apple.size * 0.9,

        "NOT YET!",

        900,
      );

      removeApple(apple);

      return;
    }

    // --------------------------------
    // 빨간사과
    // --------------------------------

    if (apple.state === "red") {
      apple.dragging = true;

      apple.dragStartX = apple.x;

      apple.dragStartY = apple.y;

      apple.wasDragged = false;

      apple.dragOffsetX = apple.x - px;

      apple.dragOffsetY = apple.y - py;

      // 잡는 순간 벌레 삭제

      removeWormForApple(apple);

      return;
    }
  }
}

// =================================================
// 드래그
// =================================================

function moveAppleInteraction(px, py) {
  for (let apple of apples) {
    if (!apple.dragging) {
      continue;
    }

    if (
      dist(
        apple.dragStartX,
        apple.dragStartY,

        px,
        py,
      ) > 8
    ) {
      apple.wasDragged = true;
    }

    apple.x = px + apple.dragOffsetX;

    apple.y = py + apple.dragOffsetY;
  }
}

// =================================================
// 드래그 종료
// =================================================

function endAppleInteraction() {
  for (let apple of apples) {
    if (!apple.dragging) {
      continue;
    }

    apple.dragging = false;

    // --------------------------------
    // 드래그하지 않고 그냥 클릭
    // 원래 위치로
    // --------------------------------

    if (!apple.wasDragged) {
      apple.x = apple.dragStartX;

      apple.y = apple.dragStartY;

      return;
    }

    // --------------------------------
    // 바구니 근처
    // --------------------------------

    if (isNearBasket(apple)) {
      apple.basketMoving = true;

      apple.basketMoveStart = millis();

      apple.basketStartX = apple.x;

      apple.basketStartY = apple.y;

      return;
    }

    // --------------------------------
    // 잘못 놓음
    // --------------------------------

    showMessage(
      apple.x,

      apple.y + apple.size * 0.9,

      "NOT THERE!",

      1100,
    );

    apple.falling = true;

    apple.fallVelocity = 1.4;

    return;
  }
}

// =================================================
// 바구니 이동
// =================================================

function updateBasketMovement(apple) {
  let basket = getBasketInfo();

  let elapsed = millis() - apple.basketMoveStart;

  let duration = 650;

  let t = constrain(elapsed / duration, 0, 1);

  let eased = 1 - pow(1 - t, 3);

  let targetY = basket.y - basket.h * 0.12;

  apple.x = lerp(apple.basketStartX, basket.x, eased);

  apple.y = lerp(apple.basketStartY, targetY, eased);

  if (t >= 1) {
    showMessage(
      basket.x,

      basket.y - basket.h * 1.15,

      "PERFECT!",

      1000,
    );

    removeApple(apple);
  }
}

// =================================================
// 벌레 삭제
// =================================================

function removeWormForApple(apple) {
  for (let i = worms.length - 1; i >= 0; i--) {
    if (worms[i].target === apple) {
      worms.splice(i, 1);
    }
  }

  apple.wormCreated = false;
}

// =================================================
// 바구니 정보
// =================================================

function getBasketInfo() {
  let bx = width / 2;

  let by = height * 0.86;

  let bw = min(width * 0.22, 280);

  let bh = bw * 0.42;

  return {
    x: bx,

    y: by,

    w: bw,

    h: bh,
  };
}

// =================================================
// 바구니 근처 판정
// =================================================

function isNearBasket(apple) {
  let basket = getBasketInfo();

  let d = dist(
    apple.x,
    apple.y,

    basket.x,
    basket.y,
  );

  return d < basket.w * 1.45;
}

// =================================================
// 사과 제거
// =================================================

function removeApple(apple) {
  if (!apple || apple.removed || apple.vanishing) {
    return;
  }

  removeWormForApple(apple);

  apple.vanishing = true;

  apple.vanishStart = millis();

  apple.vanishDuration = 420;

  apple.alpha = 255;

  apple.scale = 1;

  spawnAppleBurst(apple);

  // 잠시 후 새 풋사과 생성

  setTimeout(
    () => {
      addNewApple();
    },

    900,
  );
}

// =================================================
// 메시지 생성
// =================================================

function showMessage(x, y, textValue, duration) {
  messages.push({
    x: x,

    y: y,

    text: textValue,

    start: millis(),

    duration: duration,
  });
}

// =================================================
// 메시지 그리기
// =================================================

function drawMessages() {
  for (let i = messages.length - 1; i >= 0; i--) {
    let m = messages[i];

    let elapsed = millis() - m.start;

    if (elapsed > m.duration) {
      messages.splice(i, 1);

      continue;
    }

    let alpha = map(elapsed, 0, m.duration, 255, 0);

    let yOffset = map(elapsed, 0, m.duration, 0, -14);

    push();

    textAlign(CENTER, CENTER);

    textStyle(BOLD);

    // 이전보다 작게

    let fontSize = constrain(width * 0.011, 14, 18);

    textSize(fontSize);

    let yy = m.y + yOffset;

    let tw = textWidth(m.text);

    // --------------------------------
    // 배경 박스
    // --------------------------------

    noStroke();

    fill(255, 247, 218, alpha);

    rectMode(CENTER);

    rect(
      m.x,
      yy,

      tw + 16,
      fontSize + 10,

      7,
    );

    // --------------------------------
    // 글씨
    // --------------------------------

    fill(45, 32, 22, alpha);

    text(
      m.text,

      m.x,

      yy,
    );

    pop();
  }
}

// =================================================
// 바구니
// 그래픽 기존 그대로
// =================================================

function drawBasket() {
  let basket = getBasketInfo();

  let bx = basket.x;

  let by = basket.y;

  let bw = basket.w;

  let bh = basket.h;

  // 그림자

  noStroke();

  fill(0, 0, 0, 18);

  ellipse(
    bx,

    by + bh * 0.42,

    bw * 0.95,

    bh * 0.35,
  );

  // 손잡이

  stroke("#8B5A2B");

  strokeWeight(bw * 0.045);

  noFill();

  arc(
    bx,

    by - bh * 0.1,

    bw * 0.72,

    bh * 1.15,

    PI,

    TWO_PI,
  );

  // 몸통

  noStroke();

  fill("#B97A3D");

  beginShape();

  vertex(
    bx - bw * 0.48,

    by - bh * 0.18,
  );

  vertex(
    bx + bw * 0.48,

    by - bh * 0.18,
  );

  vertex(
    bx + bw * 0.36,

    by + bh * 0.36,
  );

  vertex(
    bx - bw * 0.36,

    by + bh * 0.36,
  );

  endShape(CLOSE);

  // 윗 테두리

  fill("#C98A49");

  rectMode(CENTER);

  rect(
    bx,

    by - bh * 0.18,

    bw * 0.96,

    bh * 0.16,

    bh * 0.08,
  );

  // 아래 음영

  fill(0, 0, 0, 22);

  beginShape();

  vertex(
    bx - bw * 0.44,

    by + bh * 0.02,
  );

  vertex(
    bx + bw * 0.44,

    by + bh * 0.02,
  );

  vertex(
    bx + bw * 0.34,

    by + bh * 0.34,
  );

  vertex(
    bx - bw * 0.34,

    by + bh * 0.34,
  );

  endShape(CLOSE);

  // 세로 엮임

  stroke("#9A632F");

  strokeWeight(2);

  for (let i = -3; i <= 3; i++) {
    let x = bx + i * (bw * 0.11);

    line(
      x,

      by - bh * 0.14,

      x * 0.85 + bx * 0.15,

      by + bh * 0.3,
    );
  }

  // 가로 엮임

  for (let j = 0; j < 3; j++) {
    let y = by - bh * 0.02 + j * (bh * 0.13);

    line(
      bx - bw * 0.39,

      y,

      bx + bw * 0.39,

      y,
    );
  }

  noStroke();
}

// =================================================
// 잎 색
// =================================================

function pickFrontColor() {
  return random(frontPalette);
}

// =================================================
// 잎 데이터
// =================================================

function createLeafData(
  x,
  y,
  size,
  rotation,
  colorValue,
  phase,
  swaySpeed,
  swayAmount,
) {
  return {
    x: x,

    y: y,

    w: size * random(0.3, 0.44),

    h: size * random(0.84, 1.1),

    rotation: rotation,

    color: colorValue,

    phase: phase,

    swaySpeed: swaySpeed,

    swayAmount: swayAmount,
  };
}

// =================================================
// 잎 전체
// =================================================

function drawLeaves(arr, drawVein) {
  for (let leaf of arr) {
    drawLeaf(leaf, drawVein);
  }
}

// =================================================
// 잎 하나
// =================================================

function drawLeaf(leaf, drawVein) {
  push();

  let floatX = sin(frameCount * 0.06 + leaf.phase) * 1.1;

  let floatY = sin(frameCount * 0.08 + leaf.phase * 1.7) * 0.8;

  translate(leaf.x + floatX, leaf.y + floatY);

  let swing =
    sin(frameCount * leaf.swaySpeed + leaf.phase) * leaf.swayAmount * 0.7 +
    sin(frameCount * 0.12 + leaf.phase) * 2.0;

  rotate(radians(leaf.rotation + swing));

  translate(0, -leaf.h * 0.18);

  fill(leaf.color);

  beginShape();

  vertex(0, -leaf.h / 2);

  bezierVertex(
    leaf.w * 0.58,

    -leaf.h * 0.28,

    leaf.w * 0.56,

    leaf.h * 0.22,

    0,

    leaf.h / 2,
  );

  bezierVertex(
    -leaf.w * 0.56,

    leaf.h * 0.22,

    -leaf.w * 0.58,

    -leaf.h * 0.28,

    0,

    -leaf.h / 2,
  );

  endShape(CLOSE);

  if (drawVein) {
    stroke(255, 255, 255, 14);

    strokeWeight(1);

    line(
      0,

      -leaf.h * 0.42,

      0,

      leaf.h * 0.42,
    );

    noStroke();
  }

  pop();
}

// =================================================
// 터치
// =================================================

function touchStarted() {
  if (touches.length > 0) {
    startAppleInteraction(
      touches[0].x,

      touches[0].y,
    );
  }

  return false;
}

function touchMoved() {
  if (touches.length > 0) {
    moveAppleInteraction(
      touches[0].x,

      touches[0].y,
    );
  }

  return false;
}

function touchEnded() {
  endAppleInteraction();

  return false;
}
