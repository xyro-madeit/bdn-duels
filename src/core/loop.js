// Fixed-timestep loop: physics at `hz`, rendering every animation frame with an
// interpolation factor (alpha) between the last two physics states.
export function startLoop({ step, render, hz = 120, maxSteps = 12 }) {
  const dt = 1 / hz;
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += frameDt;
    let n = 0;
    while (acc >= dt && n < maxSteps) {
      step(dt);
      acc -= dt;
      n++;
    }
    if (n >= maxSteps) acc = 0; // spiral-of-death guard
    render(acc / dt, frameDt);
  }
  requestAnimationFrame(frame);
  return { dt };
}
