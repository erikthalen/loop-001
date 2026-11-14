/**
 * A small WebGL scene: on every beat a water drop forms at the top, falls, and splashes.
 * Black background, white light on the water, like a slow-motion splash video.
 *
 * Physics (JS, see `water.ts` and `stepPhysics` below):
 * - The water surface is a height grid that moves with the classic two-buffer wave algorithm.
 * - A drop grows at the top (its volume grows at a steady rate), lets go,
 *   and falls with constant gravity. The release time is picked so it lands on the beat.
 * - The impact pushes a hole into the water. Droplets fly out of the rim (the crown)
 *   and follow gravity. When the hole closes, the water shoots up in a jet.
 * - Every droplet that falls back makes its own small ripple.
 *
 * Rendering (one fragment shader): ray marching. For each pixel a ray goes out from the
 * camera until it hits the water or a droplet. The colour is the light that the water
 * reflects (and refracts, for droplets) from a few soft white lights.
 */

import { createWater, type Water } from './water'

export interface Drop {
  /** Audio time (seconds) when the drop hits the water. */
  time: number
  /** A bigger drop and splash (for example the first beat of a bar). */
  strong: boolean
}

export interface DropScene {
  /**
   * Replace all drops that have not landed yet.
   * Pass a guess for the next beat too: the drop must start to fall before the beat event arrives.
   */
  plan(drops: Drop[]): void
  /** Stop drawing and free the WebGL context. */
  destroy(): void
}

export interface DropSceneOptions {
  /** The current audio time (seconds). Drops land on this clock. */
  now: () => number
}

// World units. The water surface is at y = 0, the splash at x = z = 0.
const CAMERA = [0, 0.5, -2.4] as const
const TARGET = [0, 0.25, 0] as const
/** Distance from the eye to the screen, in screen heights. Smaller is a wider view. */
const FOCAL = 1.8

/** Physics steps per second. The wave speed depends on it. */
const STEP_RATE = 120
const DT = 1 / STEP_RATE
/** Seconds from release to impact. With the height of the fall this sets gravity. */
const FALL_TIME = 0.38
const DROP_RADIUS = 0.05
const STRONG_DROP_RADIUS = 0.064
/** How deep a hole one unit of momentum (radius² × speed) makes. */
const IMPACT_DEPTH = 4
/** The grey of the background and of calm water, 0 to 1. Match it in styles.ts. */
const BACKGROUND = 0.17
/** The most droplets drawn at the same time. */
const MAX_BALLS = 40

const VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCamera;
uniform vec3 uTarget;
uniform sampler2D uHeights;  // the water heights
uniform float uExtent;       // the water grid covers -uExtent .. +uExtent
uniform vec4 uBalls[${MAX_BALLS}];  // droplets: xyz centre, w radius
uniform vec4 uNecks[${MAX_BALLS}];  // where a droplet is still joined to the water: xyz, w thickness (0: free)
uniform int uCount;
uniform vec4 uBounds;        // a sphere around all droplets
uniform vec2 uForming;       // the drop that grows at the top: x centre y, y radius (0: none)

out vec4 fragColor;

const float FOCAL = ${FOCAL.toFixed(2)};

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float waterHeight(vec2 xz) {
  vec2 uv = xz / uExtent * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture(uHeights, uv).r;
}

// A cone with round ends, from a (radius ra) to b (radius rb).
float cone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float droplets(vec3 p) {
  float bound = length(p - uBounds.xyz) - uBounds.w;
  if (bound > 0.1) return bound;
  float d = 1e3;
  for (int i = 0; i < ${MAX_BALLS}; i++) {
    if (i >= uCount) break;
    vec4 ball = uBalls[i];
    float di = length(p - ball.xyz) - ball.w;
    vec4 neck = uNecks[i];
    if (neck.w > 0.0) di = min(di, cone(p, neck.xyz, ball.xyz, neck.w, ball.w * 0.7));
    d = smin(d, di, 0.022); // close droplets melt together, like water
  }
  return d;
}

float formingDrop(vec3 p) {
  if (uForming.y <= 0.0) return 1e3;
  return length(p - vec3(0.0, uForming.x, 0.0)) - uForming.y;
}

// Distance to the nearest surface. 'wet' is 0 on the flat water and 1 on droplets.
float scene(vec3 p, out float wet) {
  float water = (p.y - waterHeight(p.xz)) * 0.6;
  float drops = min(droplets(p), formingDrop(p));
  wet = clamp(0.5 + (water - drops) / 0.03, 0.0, 1.0);
  return smin(water, drops, 0.04);
}

float sceneDistance(vec3 p) {
  float wet;
  return scene(p, wet);
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * sceneDistance(p + e.xyy) + e.yyx * sceneDistance(p + e.yyx) +
    e.yxy * sceneDistance(p + e.yxy) + e.xxx * sceneDistance(p + e.xxx));
}

// The studio: dark grey, one soft light from above and small sharp lights for the glints.
const float BACKGROUND = ${BACKGROUND.toFixed(3)};
const vec3 UP = vec3(0.0, 1.0, 0.0);
const vec3 KEY = normalize(vec3(-0.35, 1.0, -0.45));  // soft light: above, a little in front
const vec3 GLINT = normalize(vec3(0.3, 0.9, 0.6));    // sharp light: above, behind the splash

// Light that a shiny surface reflects in direction d (no flat panes: flat water reflects nothing).
float glints(vec3 d) {
  float light = pow(max(dot(d, GLINT), 0.0), 60.0) * 2.0;
  // Two thin strips, left and right: bright edges on the jet and the crown.
  light += 1.2 * smoothstep(0.85, 0.95, abs(d.x)) * smoothstep(0.0, 0.15, d.y) * (1.0 - smoothstep(0.4, 0.6, d.y));
  return light;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec3 forward = normalize(uTarget - uCamera);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 ray = normalize(forward * FOCAL + right * uv.x + up * uv.y);

  // March along the ray until it hits something.
  float t = 0.0;
  float wet = 0.0;
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    float d = scene(uCamera + ray * t, wet);
    if (d < 0.0004 * t) { hit = true; break; }
    t += d;
    if (t > 14.0) break;
  }

  float grey = BACKGROUND;
  if (hit) {
    vec3 p = uCamera + ray * t;
    vec3 n = normalAt(p);
    float facing = max(dot(n, -ray), 0.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0); // water reflects more at a low angle

    // Shading compared to flat water: flat water has exactly the background grey,
    // slopes that face the light are lighter, slopes that face away are darker.
    float shade = mix(0.6, 0.12, wet) * (dot(n, KEY) - dot(UP, KEY));
    // Droplets: lighter than the background, with a bright rim.
    shade += wet * (0.14 + 0.4 * pow(1.0 - facing, 3.0));
    float shine = glints(reflect(ray, n)) * (0.3 + fresnel);
    shine += wet * 0.4 * glints(refract(ray, n, 0.75)) * (1.0 - fresnel);

    float fade = exp(-max(t - 2.5, 0.0) * 0.5); // far water melts into the background
    grey = BACKGROUND + (shade + shine) * fade;
  }

  fragColor = vec4(vec3(clamp(grey, 0.0, 1.0)), 1.0);
}
`

interface PlannedDrop extends Drop {
  landed: boolean
}

interface Ball {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  radius: number
  /** Audio time when it was made. */
  born: number
  /** Seconds it stays joined to the water (crown sheet, jet). 0: free. */
  neck: number
  /** Where the neck starts on the water. */
  baseX: number
  baseZ: number
}

interface Impact {
  time: number
  depth: number
  speed: number
  strong: boolean
  jet: boolean
}

/** Draw drops on `canvas`. Returns `null` when WebGL 2 is not available. */
export function createDropScene(canvas: HTMLCanvasElement, { now }: DropSceneOptions): DropScene | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl) return null

  const program = createProgram(gl, VERTEX, FRAGMENT)
  if (!program) return null
  gl.useProgram(program)

  // Two triangles that cover the canvas.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    resolution: uniform('uResolution'),
    heights: uniform('uHeights'),
    extent: uniform('uExtent'),
    balls: uniform('uBalls'),
    necks: uniform('uNecks'),
    count: uniform('uCount'),
    bounds: uniform('uBounds'),
    forming: uniform('uForming'),
  }
  gl.uniform3fv(uniform('uCamera'), CAMERA)
  gl.uniform3fv(uniform('uTarget'), TARGET)

  // The water, and a texture that gets its heights every frame.
  const water = createWater({ size: 240, extent: 1.4 })
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(u.heights, 0)
  gl.uniform1f(u.extent, water.extent)

  // Where the drop lets go: just under the top edge of the picture.
  const top = topOfView()
  const releaseY = top - DROP_RADIUS
  // Gravity, so that a fall from the release point takes FALL_TIME.
  const gravity = (2 * releaseY) / FALL_TIME ** 2

  let drops: PlannedDrop[] = [] // sorted by time
  let balls: Ball[] = []
  let impacts: Impact[] = []
  let clock: number | undefined // audio time of the last physics step
  let frame = 0
  let idle = false // true when the last drawn frame showed nothing moving

  const ballData = new Float32Array(MAX_BALLS * 4)
  const neckData = new Float32Array(MAX_BALLS * 4)

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(u.resolution, canvas.width, canvas.height)
    idle = false // a resize clears the canvas, so draw again
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  /** Hit the water: a hole, and a ring of droplets thrown up and out (the crown). */
  const impact = (drop: PlannedDrop, time: number) => {
    const radius = drop.strong ? STRONG_DROP_RADIUS : DROP_RADIUS
    const speed = gravity * FALL_TIME
    const depth = IMPACT_DEPTH * radius * radius * speed
    water.disturb(0, 0, radius * 3, -depth)
    impacts.push({ time, depth, speed, strong: drop.strong, jet: false })

    const count = drop.strong ? 18 : 14
    const turn = Math.random() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      const angle = turn + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15
      const out = speed * (0.15 + 0.05 * Math.random())
      const upward = speed * (0.3 + 0.08 * Math.random())
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      balls.push({
        x: cos * radius * 1.1,
        y: 0,
        z: sin * radius * 1.1,
        vx: cos * out,
        vy: upward,
        vz: sin * out,
        radius: radius * (0.26 + 0.08 * Math.random()),
        born: time,
        neck: 0.1 + 0.04 * Math.random(),
        baseX: cos * radius * 1.1,
        baseZ: sin * radius * 1.1,
      })
    }
  }

  /** The hole closes and pushes water up in the middle: the jet (a "Worthington jet"). */
  const jet = (impact: Impact, time: number) => {
    impact.jet = true
    const parts = impact.strong ? 6 : 5
    for (let i = 0; i < parts; i++) {
      // Faster parts on top: the column stretches, gets thin, and breaks into drops.
      const speed = impact.speed * (impact.strong ? 0.7 : 0.6) * (1 - i * 0.11)
      balls.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: speed,
        vz: 0,
        radius: DROP_RADIUS * (0.55 - i * 0.03),
        born: time,
        neck: i === parts - 1 ? 0.22 : 0,
        baseX: 0,
        baseZ: 0,
      })
    }
  }

  const stepPhysics = (time: number) => {
    // Drops that reach the water now.
    for (const drop of drops) {
      if (!drop.landed && drop.time <= time) {
        drop.landed = true
        impact(drop, time)
      }
    }

    // The jet starts when the hole has (almost) closed and the water in the middle moves up.
    for (const hit of impacts) {
      if (!hit.jet && water.heightAt(0, 0) > -hit.depth * 0.25 && water.velocityAt(0, 0) > 0) jet(hit, time)
    }
    impacts = impacts.filter((hit) => !hit.jet && time - hit.time < 1)

    // Droplets fly with gravity. Back in the water, they make a small ripple and are gone.
    balls = balls.filter((ball) => {
      ball.vy -= gravity * DT
      ball.x += ball.vx * DT
      ball.y += ball.vy * DT
      ball.z += ball.vz * DT
      const surface = water.heightAt(ball.x, ball.z)
      if (ball.vy < 0 && ball.y < surface) {
        water.disturb(ball.x, ball.z, ball.radius * 3, -IMPACT_DEPTH * ball.radius ** 2 * -ball.vy)
        return false
      }
      return true
    })
    if (balls.length > MAX_BALLS) balls = balls.slice(-MAX_BALLS)

    water.step()
  }

  const draw = () => {
    frame = requestAnimationFrame(draw)
    const time = now()

    // Run the physics in fixed steps up to now. After a long pause, do not catch up.
    if (clock === undefined || time < clock || time - clock > 0.25) clock = time
    while (clock + DT <= time) {
      clock += DT
      stepPhysics(clock)
    }
    drops = drops.filter((drop) => !drop.landed || drop.time > time - 1)

    // Drops in the air: they fall from the release point and land on their beat.
    let count = 0
    const add = (ball: Ball | { x: number; y: number; z: number; radius: number }, neck?: number[]) => {
      if (count >= MAX_BALLS) return
      ballData.set([ball.x, ball.y, ball.z, ball.radius], count * 4)
      neckData.set(neck ?? [0, 0, 0, 0], count * 4)
      count++
    }
    let forming: PlannedDrop | undefined
    let formStart = 0
    let lastRelease: number | undefined
    for (const drop of drops) {
      const release = drop.time - FALL_TIME
      if (drop.landed) {
        lastRelease = release
        continue
      }
      if (time >= release) {
        const fallen = time - release
        // Constant acceleration from where it grew (big drops start a little lower) to the water.
        const start = top - radiusOf(drop)
        add({ x: 0, y: start * (1 - (fallen / FALL_TIME) ** 2), z: 0, radius: radiusOf(drop) })
      } else if (!forming) {
        forming = drop
        // It starts to grow when the drop before it lets go (at most 0.6 s before its own release).
        formStart = Math.max(lastRelease ?? -Infinity, release - 0.6)
      }
      lastRelease = release
    }

    // Droplets from the splash.
    for (const ball of balls) {
      const age = time - ball.born
      const joined = ball.neck > 0 && age < ball.neck
      const thickness = joined ? ball.radius * 0.9 * (1 - age / ball.neck) : 0
      add(ball, [ball.baseX * (1 + age * 6), 0, ball.baseZ * (1 + age * 6), thickness])
    }

    // The drop that grows at the top. Its volume grows at a steady rate.
    let formingData = [0, 0]
    if (forming) {
      const release = forming.time - FALL_TIME
      const full = Math.min(1, Math.max(0, (time - formStart) / (release - formStart)))
      const radius = radiusOf(forming) * Math.cbrt(full)
      if (radius > 0.002) {
        // It grows down from the top edge of the picture.
        formingData = [top - radius, radius]
      }
    }

    // Nothing moves: draw one more frame, then rest.
    const empty = count === 0 && formingData[1] === 0 && water.energy() < 0.0005
    if (empty && idle) return
    idle = empty

    gl.uniform4fv(u.balls, ballData)
    gl.uniform4fv(u.necks, neckData)
    gl.uniform1i(u.count, count)
    gl.uniform4fv(u.bounds, boundsOf(ballData, neckData, count))
    gl.uniform2fv(u.forming, formingData)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, water.size, water.size, 0, gl.RED, gl.FLOAT, water.heights)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
  frame = requestAnimationFrame(draw)

  return {
    plan(next) {
      const time = now()
      drops = drops
        .filter((drop) => drop.landed || drop.time <= time)
        .concat(next.filter((drop) => drop.time > time - DT).map((drop) => ({ ...drop, landed: false })))
        .sort((a, b) => a.time - b.time)
    },
    destroy() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

const radiusOf = (drop: Drop) => (drop.strong ? STRONG_DROP_RADIUS : DROP_RADIUS)

/** The world height at the top edge of the picture, straight above the splash. */
function topOfView(): number {
  const [cx, cy, cz] = CAMERA
  const fx = TARGET[0] - cx
  const fy = TARGET[1] - cy
  const fz = TARGET[2] - cz
  const length = Math.hypot(fx, fy, fz)
  const [x, y, z] = [fx / length, fy / length, fz / length]
  // up = forward × right, with right = (0, 1, 0) × forward.
  const right = normalize([z, 0, -x])
  const up = [y * right[2]! - z * right[1]!, z * right[0]! - x * right[2]!, x * right[1]! - y * right[0]!]
  const ray = [x * FOCAL + up[0]! * 0.5, y * FOCAL + up[1]! * 0.5, z * FOCAL + up[2]! * 0.5]
  const t = -cz / ray[2]!
  return cy + ray[1]! * t
}

function normalize(v: number[]): number[] {
  const length = Math.hypot(...v)
  return v.map((value) => value / length)
}

/** A sphere around all droplets and necks, so the shader can skip them quickly. */
function boundsOf(balls: Float32Array, necks: Float32Array, count: number): number[] {
  if (count === 0) return [0, -10, 0, 0]
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  const grow = (x: number, y: number, z: number, r: number) => {
    min = [Math.min(min[0]!, x - r), Math.min(min[1]!, y - r), Math.min(min[2]!, z - r)]
    max = [Math.max(max[0]!, x + r), Math.max(max[1]!, y + r), Math.max(max[2]!, z + r)]
  }
  for (let i = 0; i < count; i++) {
    const [x, y, z, r] = balls.subarray(i * 4, i * 4 + 4)
    grow(x!, y!, z!, r!)
    if (necks[i * 4 + 3]! > 0) grow(necks[i * 4]!, necks[i * 4 + 1]!, necks[i * 4 + 2]!, necks[i * 4 + 3]!)
  }
  const centre = [0, 1, 2].map((i) => (min[i]! + max[i]!) / 2)
  return [...centre, Math.hypot(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) / 2]
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram | null {
  const program = gl.createProgram()!
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Metronome drop shader:', gl.getShaderInfoLog(shader))
      return null
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Metronome drop shader:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}
