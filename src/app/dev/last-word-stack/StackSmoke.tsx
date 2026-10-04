'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { animated, useSpring } from '@react-spring/three';
import { useDrag } from '@use-gesture/react';
import { motion, useReducedMotion } from 'motion/react';
import { useMachine } from '@xstate/react';
import { setup } from 'xstate';
import { createStore, useStore, type StoreApi } from 'zustand';
import { Howl } from 'howler';
import type { Mesh } from 'three';

// Technical toggle only. This is deliberately not the Last Word game machine.
const toggleMachine = setup({ types: { events: {} as { type: 'TOGGLE' } } }).createMachine({
  initial: 'off',
  states: {
    off: { on: { TOGGLE: 'on' } },
    on: { on: { TOGGLE: 'off' } },
  },
});

type SmokeData = { value: number };

function SmokeMesh({ store, immediate }: { store: StoreApi<SmokeData>; immediate: boolean }) {
  const value = useStore(store, (state) => state.value);
  const mesh = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);
  const { scale } = useSpring({ scale: 1 + value * 0.25, immediate });

  // Browser-test observations of the actual renderer, not synthetic success flags.
  useFrame(() => {
    gl.domElement.dataset.meshScale = String(mesh.current?.scale.x ?? 0);
    gl.domElement.dataset.r3fValue = String(value);
  });

  return (
    <Center onCentered={() => { gl.domElement.dataset.dreiCentered = 'true'; }}>
      <animated.mesh ref={mesh} scale={scale} onAfterRender={() => {
        gl.domElement.dataset.rendered = 'true';
      }}>
        <boxGeometry />
        <meshBasicMaterial color="#56b4e9" />
      </animated.mesh>
    </Center>
  );
}

export default function StackSmoke() {
  const [store] = useState(() => createStore<SmokeData>(() => ({ value: 0 })));
  const value = useStore(store, (state) => state.value);
  const [state, send] = useMachine(toggleMachine);
  const systemReducedMotion = useReducedMotion();
  const [disableAnimation, setDisableAnimation] = useState(false);
  const [lite, setLite] = useState(false);
  const [gesture, setGesture] = useState('waiting');
  const [audio, setAudio] = useState('initializing');
  const immediate = Boolean(systemReducedMotion || disableAnimation);
  const bind = useDrag(({ last, movement: [x] }) => {
    if (last) setGesture(Math.abs(x) > 10 ? 'drag observed' : 'pointer observed');
  }, { axis: 'x' });

  useEffect(() => {
    // One silent PCM sample; initialization only, no autoplay or network asset.
    const sound = new Howl({
      src: ['data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA=='],
      format: ['wav'], preload: false, volume: 0,
    });
    setAudio(sound.state());
    return () => { sound.unload(); };
  }, []);

  return (
    <main style={{ padding: '100px 24px 32px', maxWidth: 720, margin: 'auto' }}>
      <h1>Last Word stack smoke test</h1>
      <p>Development-only dependency verification.</p>
      <p data-testid="audio">Howler: {audio}</p>
      <p data-testid="dom-value">DOM value: {value}</p>
      <button onClick={() => store.setState({ value: value + 1 })}>Increment shared value</button>
      <button onClick={() => send({ type: 'TOGGLE' })} style={{ marginLeft: 16 }}>Toggle machine</button>
      <motion.p
        data-testid="machine" data-reduced-motion={immediate}
        animate={{ x: state.matches('on') ? 20 : 0 }}
        transition={{ duration: immediate ? 0 : 0.2 }}
      >
        XState: {String(state.value)}
      </motion.p>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={disableAnimation} onChange={(e) => setDisableAnimation(e.target.checked)} />
        Disable animation
      </label>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={lite} onChange={(e) => setLite(e.target.checked)} />
        DOM-only presentation
      </label>
      <div
        {...bind()} data-testid="gesture" aria-label="Pointer gesture test area"
        style={{ touchAction: 'pan-y', border: '1px solid currentColor', padding: 24, margin: '16px 0' }}
      >
        Drag horizontally: {gesture}
      </div>
      <div style={{ height: 260, background: '#142333' }}>
        {lite ? <p style={{ color: 'white' }}>DOM-only value: {value}</p> : (
          <Canvas camera={{ position: [0, 0, 5] }} dpr={1} fallback={<p>WebGL unavailable; use DOM-only presentation.</p>}>
            <SmokeMesh store={store} immediate={immediate} />
          </Canvas>
        )}
      </div>
    </main>
  );
}
