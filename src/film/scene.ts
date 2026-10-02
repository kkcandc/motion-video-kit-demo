import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { FrameState } from "./frame";

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uCA: { value: 0.0012 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uCA;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      vec2 off = c * d * uCA;
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      vec3 col = max(vec3(r, g, b), 0.0);
      float lower = smoothstep(0.46, 0.12, vUv.y);
      col *= mix(1.0, 0.62, lower);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radialTexture(inner: string, outer: string, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const gradient = g.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,248,236,0.95)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 512, 64);
  const vertical = g.createLinearGradient(0, 0, 0, 64);
  vertical.addColorStop(0, "rgba(0,0,0,1)");
  vertical.addColorStop(0.5, "rgba(0,0,0,0)");
  vertical.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = vertical;
  g.fillRect(0, 0, 512, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addTicks(parent: THREE.Object3D, radius: number): void {
  const ice = new THREE.MeshStandardMaterial({
    color: 0xd7e6ff,
    emissive: 0x8eadd8,
    emissiveIntensity: 0.45,
    metalness: 0.7,
    roughness: 0.28,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xe7d3ae,
    emissive: 0x8a6232,
    emissiveIntensity: 0.28,
    metalness: 0.9,
    roughness: 0.32,
  });
  const cardinals: number[] = [];
  const majors: number[] = [];
  const minors: number[] = [];
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    if (deg % 90 === 0) cardinals.push(deg);
    else if (deg % 15 === 0) majors.push(deg);
    else minors.push(deg);
  }
  const place = (degrees: number[], material: THREE.Material, width: number, height: number) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, degrees.length);
    const dummy = new THREE.Object3D();
    degrees.forEach((deg, index) => {
      const a = (deg * Math.PI) / 180;
      dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      dummy.rotation.set(0, 0, a);
      dummy.scale.set(width, height, 0.02);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  };
  place(cardinals, brass, 0.018, 0.16);
  place(majors, ice, 0.01, 0.09);
  place(minors, ice, 0.005, 0.042);
}

export type FilmScene = {
  apply: (state: FrameState) => void;
  resize: (width: number, height: number) => void;
  render: () => void;
  canvas: HTMLCanvasElement;
};

export function createScene(canvas: HTMLCanvasElement, starCount: number): FilmScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.15;
    pmrem.dispose();
  } catch (error) {
    console.warn("Studio environment skipped", error);
  }

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vec3 n = normalize(vPos);
          float h = n.y * 0.5 + 0.5;
          vec3 col = mix(vec3(0.006, 0.008, 0.014), vec3(0.035, 0.05, 0.09), smoothstep(0.15, 1.0, h));
          float horizon = exp(-abs(n.y) * 16.0);
          col += vec3(0.11, 0.13, 0.18) * horizon * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const rand = mulberry32(0x4e4c31);
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhase = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const radius = 18 + rand() * 40;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.72;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const bright = rand() > 0.92;
    starSizes[i] = bright ? 5.5 + rand() * 4 : 1.4 + rand() * 2.4;
    starPhase[i] = rand() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute("aPhase", new THREE.BufferAttribute(starPhase, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vTw;
      void main() {
        vTw = 0.55 + 0.45 * sin(uTime * 1.25 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * vTw * (210.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float star = smoothstep(0.5, 0.05, d);
        vec3 col = vec3(0.78, 0.86, 1.0) * (1.35 * vTw);
        gl_FragColor = vec4(col, star);
      }
    `,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const dustCount = 70;
  const dustBase = new Float32Array(dustCount * 3);
  const dustPhase = new Float32Array(dustCount);
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustBase[i * 3] = (rand() - 0.5) * 7;
    dustBase[i * 3 + 1] = (rand() - 0.5) * 4.2;
    dustBase[i * 3 + 2] = (rand() - 0.5) * 5;
    dustPhase[i] = rand() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xc9d7ef,
      size: 0.018,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  scene.add(new THREE.AmbientLight(0x8ea0c0, 0.12));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.35);
  key.position.set(4.2, 5.4, 3.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9eb6ff, 1.7);
  rim.position.set(-4.5, 1.4, -3.6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x1c2838, 0.35);
  fill.position.set(0, -2, 5);
  scene.add(fill);
  const coreLight = new THREE.PointLight(0xffc89a, 0, 5, 2);
  coreLight.position.set(0, 0.15, 0.2);
  scene.add(coreLight);

  const instrument = new THREE.Group();
  instrument.position.y = 0.18;
  scene.add(instrument);

  const brass = new THREE.MeshPhysicalMaterial({
    color: 0x9a7340,
    metalness: 1,
    roughness: 0.3,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    envMapIntensity: 1.35,
  });
  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xc5d0dc,
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1.45,
  });
  const iron = new THREE.MeshPhysicalMaterial({
    color: 0x8d9bab,
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 1.2,
  });
  const inlayMat = new THREE.MeshStandardMaterial({
    color: 0x0c121c,
    emissive: 0xb7d2ff,
    emissiveIntensity: 0.7,
    metalness: 0.2,
    roughness: 0.35,
  });

  const outer = new THREE.Group();
  outer.add(new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.028, 24, 180), brass));
  outer.add(new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.006, 12, 140), inlayMat));
  const shockMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xd5e6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const shockOuterMat = shockMat();
  const shockOuter = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.008, 8, 96), shockOuterMat);
  outer.add(shockOuter);
  instrument.add(outer);

  const mid = new THREE.Group();
  mid.add(new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.02, 20, 160), steel));
  addTicks(mid, 1.22);
  const shockMidMat = shockMat();
  mid.add(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.007, 8, 90), shockMidMat));
  instrument.add(mid);

  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.016, 18, 140), iron));
  inner.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.004, 8, 100),
      new THREE.MeshStandardMaterial({
        color: 0x101820,
        emissive: 0xd7c39a,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      }),
    ),
  );
  const shockInnerMat = shockMat();
  inner.add(new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.006, 8, 80), shockInnerMat));
  instrument.add(inner);

  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIgnite: { value: 0.2 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIgnite;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.15);
        float lat = asin(clamp(N.y, -1.0, 1.0));
        float lon = atan(N.z, N.x) + uTime * 0.32;
        float bands = smoothstep(0.16, 0.0, abs(sin(lat * 9.0)));
        float equator = smoothstep(0.045, 0.0, abs(lat));
        float meridian = smoothstep(0.09, 0.0, abs(sin(lon)));
        float wire = max(max(bands, equator), meridian * 0.85);
        vec3 ice = vec3(0.62, 0.78, 1.0);
        vec3 warm = vec3(1.0, 0.76, 0.42);
        vec3 col = vec3(0.012, 0.016, 0.024);
        col += ice * wire * (0.22 + uIgnite * 0.55);
        col += ice * fres * 0.28;
        col += warm * fres * uIgnite * 0.45;
        col += warm * uIgnite * 0.05;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 64, 48), coreMat);
  instrument.add(core);

  const shellMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uIgnite: { value: 0.2 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIgnite;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
        vec3 ice = vec3(0.62, 0.78, 1.0);
        vec3 warm = vec3(1.0, 0.8, 0.5);
        vec3 col = ice * fres + warm * fres * uIgnite;
        gl_FragColor = vec4(col, fres * (0.45 + uIgnite * 0.25));
      }
    `,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.46, 64, 48), shellMat);
  shell.renderOrder = 2;
  instrument.add(shell);

  const needleMat = brass.clone() as THREE.MeshPhysicalMaterial;
  const needle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.52, 0.018), needleMat);
  shaft.position.y = 0.46;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 20), needleMat);
  head.position.y = 0.76;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.012), needleMat);
  tail.position.y = 0.12;
  needle.add(shaft, head, tail);
  needle.position.z = 0.05;
  instrument.add(needle);

  const beadMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f6ff,
    metalness: 1,
    roughness: 0.12,
    emissive: 0x9eb6e0,
    emissiveIntensity: 0.25,
    envMapIntensity: 1.4,
  });
  const beads = new THREE.Group();
  const beadMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), beadMat);
    beads.add(bead);
    beadMeshes.push(bead);
  }
  instrument.add(beads);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.004, 8, 120),
    new THREE.MeshBasicMaterial({
      color: 0xc5d4ee,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.rotation.x = Math.PI / 2.4;
  instrument.add(halo);

  const glowMat = new THREE.MeshBasicMaterial({
    map: radialTexture("rgba(190,214,255,0.9)", "rgba(190,214,255,0)"),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.2,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  instrument.add(glow);

  const flareMat = new THREE.MeshBasicMaterial({
    map: flareTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flareMat);
  instrument.add(flare);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({
      map: radialTexture("rgba(0,0,0,0.55)", "rgba(0,0,0,0)"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.35;
  scene.add(shadow);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.22, 0.84);
  composer.addPass(bloom);
  const grade = new ShaderPass(gradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  let width = 1;
  let height = 1;

  const applyXform = (group: THREE.Group, x: FrameState["outer"]) => {
    group.visible = x.s > 0.01;
    group.position.set(x.x, x.y, x.z);
    group.rotation.set(x.rx, x.ry, x.rz);
    group.scale.setScalar(Math.max(x.s, 0.0001));
  };

  return {
    canvas,
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, Math.floor(nextWidth));
      height = Math.max(1, Math.floor(nextHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, width < 900 ? 1.5 : 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
      bloom.setSize(width * dpr, height * dpr);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    apply(state: FrameState) {
      applyXform(outer, state.outer);
      applyXform(mid, state.mid);
      applyXform(inner, state.inner);
      const shocks = [shockOuterMat, shockMidMat, shockInnerMat];
      const shockMeshes = [shockOuter, mid.children.at(-1) as THREE.Mesh, inner.children.at(-1) as THREE.Mesh];
      state.shock.forEach((wave, index) => {
        const material = shocks[index];
        const mesh = shockMeshes[index];
        if (!material || !mesh) return;
        material.opacity = wave.o * 0.85;
        mesh.scale.setScalar(wave.s);
      });

      needle.visible = state.t > 6.45;
      needle.rotation.z = -state.needle;
      needle.scale.setScalar(state.t <= 6.55 ? 0.001 : Math.min(impactScale(state.t), 1));
      needleMat.emissive.set(0xffb15a);
      needleMat.emissiveIntensity = 0.05 + state.needleGlow * 0.9;

      core.scale.setScalar(state.coreScale);
      shell.scale.setScalar(Math.max(state.coreScale, 0.2));
      coreMat.uniforms.uTime.value = state.t;
      coreMat.uniforms.uIgnite.value = state.ignite;
      shellMat.uniforms.uIgnite.value = state.ignite;
      shell.visible = state.coreScale > 0.2;
      inlayMat.emissiveIntensity = 0.22 + state.ignite * 0.55;
      coreLight.intensity = state.ignite * 5.5;

      const beadRadius = 1.48;
      beadMeshes.forEach((bead, index) => {
        const angle = state.beadAngle + (index * Math.PI * 2) / 3;
        bead.position.set(Math.cos(angle) * beadRadius, Math.sin(angle * 0.5) * 0.18, Math.sin(angle) * beadRadius);
        bead.visible = state.bead > 0.02;
        bead.scale.setScalar(0.7 + state.bead * 0.3);
      });
      beads.visible = state.bead > 0.02;

      (halo.material as THREE.MeshBasicMaterial).opacity = state.halo * 0.55;

      starMat.toneMapped = false;
      starMat.uniforms.uTime.value = state.t;
      stars.rotation.y = state.t * 0.012;
      const dustArray = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        const phase = dustPhase[i] ?? 0;
        dustArray[i * 3] = (dustBase[i * 3] ?? 0) + Math.sin(state.t * 0.23 + phase) * 0.18;
        dustArray[i * 3 + 1] = (dustBase[i * 3 + 1] ?? 0) + Math.cos(state.t * 0.19 + phase) * 0.1;
        dustArray[i * 3 + 2] = (dustBase[i * 3 + 2] ?? 0) + Math.sin(state.t * 0.15 + phase * 1.7) * 0.16;
      }
      dustGeo.attributes.position.needsUpdate = true;

      (shadow.material as THREE.MeshBasicMaterial).opacity = state.shadow * 0.85;

      camera.fov = state.camera.fov;
      camera.position.set(state.camera.x, state.camera.y, state.camera.z);
      camera.up.set(Math.sin(state.camera.roll), Math.cos(state.camera.roll), 0);
      camera.lookAt(state.camera.lookX, state.camera.lookY, state.camera.lookZ);
      camera.updateProjectionMatrix();

      glow.quaternion.copy(camera.quaternion);
      glow.position.set(0, 0.02, 0);
      glow.scale.setScalar(0.85 + state.ignite * 1.35);
      glowMat.opacity = 0.05 + state.ignite * 0.16;
      glowMat.toneMapped = false;

      flare.quaternion.copy(camera.quaternion);
      flare.position.set(0, 0.02, 0.2);
      flare.visible = state.flare > 0.01;
      flare.scale.set(0.3 + state.flare * 5.4, 0.035 + state.flare * 0.16, 1);
      flareMat.opacity = state.flare * 0.55;
      flareMat.toneMapped = false;
      shellMat.toneMapped = false;

      renderer.toneMappingExposure = state.exposure;
      bloom.strength = state.bloom;
      grade.uniforms.uCA.value = 0.0015 * state.ca;
    },
    render() {
      composer.render();
    },
  };
}

function impactScale(t: number): number {
  if (t <= 6.55) return 0;
  if (t >= 8.35) return 1;
  return Math.min(1, (t - 6.55) / 0.5);
}
