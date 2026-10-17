// Объемный скелет для «Ваша осанка»: из ровной стойки плавно уходит в позу человека и возвращается, камера качается
// вправо-влево, чтобы были видны и крен, и скручивание, и наклон вперед. Отклонения усилены втрое, как на плоской схеме.
// Режим «было → стало» (opts.from): полупрозрачный силуэт стоит в позе первого теста, цветная фигура переходит из нее в позу последнего.
// Фигура смотрит на камеру (+z), правая сторона человека на экране слева (-x).

const KEYS = ['tilt', 'pelvis', 'head', 'twist', 'fwd', 'headFwd', 'shrug'];
const mix = (a, b, t) => Object.fromEntries(KEYS.map(k => [k, (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t]));

/** pose: { tilt, pelvis, head, twist, fwd, headFwd, shrug } в градусах (shrug, headFwd — доли). opts.from — поза «было». Возвращает { dispose }. */
export async function skeleton3D(box, pose, opts = {}) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const w = box.clientWidth || 300, h = box.clientHeight || 300, from = opts.from || null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(w, h);
  box.appendChild(renderer.domElement); renderer.domElement.style.touchAction = 'pan-y';
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, w / h, .1, 20); camera.position.set(0, 1.05, 4.4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3ab, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1.5, 3, 2.5); scene.add(dl);
  const ctl = new OrbitControls(camera, renderer.domElement); ctl.target.set(0, .95, 0); ctl.enablePan = false; ctl.enableZoom = false;
  ctl.minPolarAngle = Math.PI * .35; ctl.maxPolarAngle = Math.PI * .6; ctl.update();
  const css = getComputedStyle(document.documentElement), col = (v, d) => new THREE.Color((css.getPropertyValue(v) || d).trim() || d);
  const mats = [], geos = [], M = o => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };
  const boneM = M({ color: 0xDCE5F7, roughness: .6 }), hotM = M({ color: col('--short', '#EF4444'), roughness: .5 }), betterM = M({ color: col('--ok', '#22C55E'), roughness: .5 });
  const ghostM = M({ color: 0x8A97B2, roughness: .8, transparent: true, opacity: .4, depthWrite: false });
  const lineM = new THREE.LineDashedMaterial({ color: 0x8C949B, dashSize: .04, gapSize: .03 }); mats.push(lineM);
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const root = new THREE.Group(); scene.add(root);
  // отвес: ровная линия от макушки до стоп, по ней видно, куда ушло тело
  { const g = new THREE.BufferGeometry().setFromPoints([V(0, .02), V(0, 1.85)]); geos.push(g); const l = new THREE.Line(g, lineM); l.computeLineDistances(); root.add(l); }
  { const g = new THREE.RingGeometry(.3, .32, 48); geos.push(g); const m = new THREE.Mesh(g, M({ color: 0xC9CDD1, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; root.add(m); }
  // «было → стало»: часть тела зеленая, если перекос уменьшился, красная, если вырос или остался заметным
  const tone = (k, keys = [k]) => { const big = x => keys.some(q => Math.abs(x[q] || 0) > .5);
    if (!from) return big(pose) ? hotM : boneM; const was = keys.reduce((s, q) => s + Math.abs(from[q] || 0), 0), now = keys.reduce((s, q) => s + Math.abs(pose[q] || 0), 0);
    return now < was - .5 ? betterM : big(pose) ? hotM : boneM; };
  function figure(m) {
    const pick = (k, keys) => m || tone(k, keys), base = m || boneM, g0 = new THREE.Group(); root.add(g0);
    const bone = (par, a, b, r, mm = base) => { const d = b.clone().sub(a), g = new THREE.CapsuleGeometry(r, Math.max(.001, d.length() - r * 2), 4, 10); geos.push(g);
      const me = new THREE.Mesh(g, mm); me.position.copy(a).add(b).multiplyScalar(.5); me.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); par.add(me); return me; };
    const ball = (par, p, r, mm = base) => { const g = new THREE.SphereGeometry(r, 16, 12); geos.push(g); const me = new THREE.Mesh(g, mm); me.position.copy(p); par.add(me); return me; };
    const pivot = (par, p) => { const o = new THREE.Object3D(); o.position.copy(p); par.add(o); return o; };
    // ноги стоят на полу, таз наклоняется над ними
    for (const s of [-1, 1]) { bone(g0, V(s * .1, .95), V(s * .1, .52), .045); bone(g0, V(s * .1, .52), V(s * .1, .08), .04); ball(g0, V(s * .1, .52), .05); bone(g0, V(s * .1, .05, -.02), V(s * .1, .05, .14), .03); }
    const pel = pivot(g0, V(0, 1)); bone(pel, V(-.15, 0), V(.15, 0), .05, pick('pelvis')); for (const s of [-1, 1]) ball(pel, V(s * .1, -.05), .06, pick('pelvis'));
    const trunk = pivot(pel, V(0, .02)); bone(trunk, V(0, 0), V(0, .48), .045, pick('trunk', ['twist', 'fwd']));
    for (let i = 0; i < 4; i++) { const g = new THREE.TorusGeometry(.13 - i * .006, .012, 6, 24, Math.PI * 1.2); geos.push(g); const r = new THREE.Mesh(g, base); r.position.set(0, .26 + i * .055, .02); r.rotation.set(Math.PI / 2, 0, -Math.PI * .1); trunk.add(r); }
    const sh = pivot(trunk, V(0, .48)); bone(sh, V(-.2, 0), V(.2, 0), .04, pick('tilt'));
    for (const s of [-1, 1]) { ball(sh, V(s * .2, 0), .055, pick('shrug')); bone(sh, V(s * .2, 0), V(s * .24, -.3), .035); bone(sh, V(s * .24, -.3), V(s * .25, -.56), .03); }
    const neck = pivot(sh, V(0, .03)); bone(neck, V(0, 0), V(0, .1), .03, pick('head', ['head', 'headFwd']));
    const head = pivot(neck, V(0, .1)); { const g = new THREE.SphereGeometry(.11, 20, 16); geos.push(g); const me = new THREE.Mesh(g, pick('head', ['head', 'headFwd'])); me.scale.set(.9, 1.1, 1); me.position.set(0, .1, 0); head.add(me); }
    const r = d => (d || 0) * Math.PI / 180;
    return p => { pel.rotation.z = r(p.pelvis); trunk.rotation.set(r(p.fwd), r(p.twist), -r(p.pelvis) * .5);
      sh.rotation.z = r(p.tilt) - r(p.pelvis) * .5; sh.position.y = .48 + (p.shrug || 0) * .03;
      neck.rotation.z = -sh.rotation.z * .5; head.rotation.z = r(p.head); head.position.z = (p.headFwd || 0) * .08; neck.rotation.x = (p.headFwd || 0) * .35; };
  }
  const ghost = from ? figure(ghostM) : null, main = figure(null), zero = {};
  if (ghost) ghost(from);
  let alive = true, user = false, t0 = performance.now(), phase = ''; ctl.addEventListener('start', () => { user = true; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  const say = p => { if (p !== phase) { phase = p; if (opts.onPhase) opts.onPhase(p); } };
  const loop = () => { if (!alive) return; if (!renderer.domElement.isConnected) return api.dispose();
    const t = (performance.now() - t0) / 1000;
    if (from) { // 6 с: было → переход → стало → обратно
      const ph = (t % 6) / 6, k = reduce ? 1 : ph < .2 ? 0 : ph < .5 ? ease((ph - .2) / .3) : ph < .9 ? 1 : 1 - ease((ph - .9) / .1);
      main(mix(from, pose, k)); say(k < .05 ? 'was' : k > .95 ? 'now' : 'move'); }
    else { const ph = (t % 5) / 5; main(mix(zero, pose, reduce ? 1 : ph < .15 ? 0 : ph < .45 ? ease((ph - .15) / .3) : ph < .85 ? 1 : 1 - ease((ph - .85) / .15))); }
    if (!user && !reduce) { const a = Math.sin(t * .6) * .7; camera.position.set(Math.sin(a) * 4.4, 1.05, Math.cos(a) * 4.4); camera.lookAt(ctl.target); } else ctl.update();
    renderer.render(scene, camera); requestAnimationFrame(loop); };
  const api = { dispose() { if (!alive) return; alive = false; ctl.dispose(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} renderer.domElement.remove(); } };
  loop(); return api;
}
