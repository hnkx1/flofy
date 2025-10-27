// main.js — Flappy Bird clone with Base transaction + click-to-start + auto-restart

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");

const W = canvas.width, H = canvas.height;

let bird, pipes, frames, score, running, started, gravity;
let birdFrame = 0;
let birdAnimTimer = 0;

// Sprites
const birdUp = new Image();
birdUp.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/yellowbird-upflap.png";
const birdMid = new Image();
birdMid.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/yellowbird-midflap.png";
const birdDown = new Image();
birdDown.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/yellowbird-downflap.png";
const birdFrames = [birdUp, birdMid, birdDown];

const bgImg = new Image();
bgImg.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/background-day.png";
const pipeNorth = new Image();
pipeNorth.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/pipe-green.png";
const pipeSouth = new Image();
pipeSouth.src = "https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/sprites/pipe-green.png";

const RECEIVER = "0xYourBaseAddressHere";
const AMOUNT_ON_DEATH = "0.00002";

// --- Base transaction logic ---
async function sendBaseTx(onProgress = console.log) {
  if (!window.ethereum) throw new Error("No wallet found");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }], // Base mainnet
    });
  } catch {}

  const signer = provider.getSigner();
  const tx = await signer.sendTransaction({
    to: RECEIVER,
    value: ethers.utils.parseEther(AMOUNT_ON_DEATH),
    data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes("flappy_score")),
  });
  onProgress(`TX sent: ${tx.hash}`);
  return tx;
}

// --- Entities ---
function createBird() {
  return { x: 80, y: H / 2, w: 34, h: 24, vy: 0, rotation: 0 };
}

function createPipe(x) {
  const gap = 140;
  const min = 60, max = H - 160 - gap;
  const top = Math.floor(Math.random() * (max - min + 1)) + min;
  return { x, top, gap, w: 52, speed: 2.5 };
}

function reset() {
  bird = createBird();
  pipes = [createPipe(W + 200), createPipe(W + 400), createPipe(W + 600)];
  frames = 0;
  score = 0;
  running = false;
  started = false;
  gravity = 0.35;
  scoreEl.textContent = "Score: 0";
  statusEl.textContent = "Click or press Space to start!";
}

function startGame() {
  if (running) return;
  started = true;
  running = true;
  statusEl.textContent = "Playing...";
}

function gameOver() {
  running = false;
  started = false;
  statusEl.textContent = "You lost! Sending transaction...";
  const capturedScore = score;

  sendBaseTx((s) => (statusEl.textContent = s))
    .then((tx) => {
      statusEl.textContent = `TX sent ${tx.hash} — Score: ${capturedScore}`;
    })
    .catch(() => (statusEl.textContent = "TX failed or user rejected. Click to restart."));
}

// --- Main loop ---
function update() {
  if (running) {
    frames++;
    bird.vy += gravity;
    bird.y += bird.vy;
    bird.rotation = Math.min(Math.PI / 4, bird.vy / 10);

    birdAnimTimer++;
    if (birdAnimTimer % 10 === 0) birdFrame = (birdFrame + 1) % 3;

    for (let p of pipes) {
      p.x -= p.speed;
      if (p.x + p.w < 0) {
        p.x = Math.max(...pipes.map((pp) => pp.x)) + 200;
        p.top = Math.floor(Math.random() * (H - 220)) + 60;
        score++;
        scoreEl.textContent = `Score: ${score}`;
      }

      const topRect = { x: p.x, y: 0, w: p.w, h: p.top };
      const bottomRect = { x: p.x, y: p.top + p.gap, w: p.w, h: H - (p.top + p.gap) };
      if (rectsCollide(bird, topRect) || rectsCollide(bird, bottomRect)) gameOver();
    }

    if (bird.y + bird.h >= H - 60 || bird.y < 0) gameOver();
  }

  draw();
  requestAnimationFrame(update);
}

function rectsCollide(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bgImg, 0, 0, W, H);

  for (let p of pipes) {
    ctx.save();
    ctx.translate(p.x, p.top);
    ctx.scale(1, -1);
    ctx.drawImage(pipeNorth, 0, 0, p.w, H);
    ctx.restore();
    ctx.drawImage(pipeSouth, p.x, p.top + p.gap, p.w, H);
  }

  ctx.fillStyle = "#ded895";
  ctx.fillRect(0, H - 60, W, 60);

  const frameImg = birdFrames[birdFrame];
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);
  ctx.drawImage(frameImg, -bird.w / 2, -bird.h / 2, bird.w, bird.h);
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font = "22px Inter";
  ctx.fillText(`Score: ${score}`, 20, 40);

  if (!started && !running) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "28px Inter";
    ctx.fillText("CLICK TO START", W / 2 - 100, H / 2);
  }
}

// input
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") handleInput();
});
canvas.addEventListener("click", handleInput);

function handleInput() {
  if (!started && !running) {
    reset();
    startGame();
  } else if (!started && running) {
    startGame();
  } else if (running) {
    bird.vy = -7.5;
  }
}

reset();
update();
