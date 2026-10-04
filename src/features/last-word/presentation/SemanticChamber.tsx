'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Float, Line, RoundedBox, Sparkles } from '@react-three/drei';
import { animated, useSpring, type SpringValue } from '@react-spring/three';
import { springs, type PresentationTier } from './tokens';

export type ChamberProps = {
  words: string[];
  selected: string | null;
  locked: boolean;
  feedback: boolean;
  best: string | null;
  confidentError: boolean;
  beatKey: string;
  reduced: boolean;
  tier: PresentationTier;
  tilt: SpringValue<number>;
  palette: { surface: string; edge: string; light: string };
  onUnavailable: () => void;
};

function WordObject({ index, ...props }: ChamberProps & { index: number }) {
  const width = useThree((state) => state.viewport.width);
  const slot = width / props.words.length;
  const homeX = (index - (props.words.length - 1) / 2) * slot;
  const chosen = props.words[index] === props.selected;
  const stronger = props.feedback && props.words[index] === props.best;
  const rejected = props.feedback && chosen && !stronger;
  const [motion, api] = useSpring(() => ({ x: homeX, y: 0, z: 0, ry: 0, rz: 0, opacity: 1, scale: 1 }));

  useEffect(() => {
    const target = {
      x: homeX + (stronger ? -Math.sign(homeX) * 0.1 : 0),
      y: stronger ? 0.1 : chosen ? 0.08 : 0,
      z: props.locked && chosen ? 0.65 : chosen ? 0.35 : 0,
      ry: chosen ? -Math.sign(homeX) * 0.04 : -Math.sign(homeX) * 0.11,
      rz: 0, scale: rejected ? 0.97 : 1, opacity: rejected ? 0.35 : 1,
    };
    api.start({
      to: rejected && !props.reduced ? [
        { ...target, opacity: 1, z: 0.6, rz: 0 },
        { ...target, z: props.confidentError ? -0.16 : 0.1, rz: 0.025, opacity: 0.65 },
        target,
      ] : target,
      immediate: props.reduced,
      config: props.locked ? springs.lock : springs.selection,
    });
  }, [api, homeX, chosen, stronger, rejected, props.locked, props.reduced, props.confidentError, props.beatKey]);

  return (
    <Float enabled={!props.reduced && !props.locked && !props.selected} speed={1.2} rotationIntensity={0} floatIntensity={0.09} floatingRange={[-0.015, 0.015]}>
      <animated.group position-x={motion.x} position-y={motion.y} position-z={motion.z} rotation-y={motion.ry} rotation-z={motion.rz} scale={motion.scale}>
        <animated.group rotation-x={props.tilt.to((value) => value * -0.035)} rotation-z={props.tilt.to((value) => value * -0.02)}>
          <RoundedBox args={[slot * 0.86, 1.67, 0.24]} radius={0.11} smoothness={4}>
            <meshPhysicalMaterial color={props.palette.surface} metalness={0.58} roughness={props.tier === 'full' ? 0.23 : 0.4} clearcoat={props.tier === 'full' ? 1 : 0} clearcoatRoughness={0.18} />
          </RoundedBox>
          <RoundedBox args={[slot * 0.86 + 0.027, 1.697, 0.19]} radius={0.12} smoothness={4} position={[0, 0, -0.015]}>
            <animated.meshBasicMaterial color={props.palette.edge} transparent opacity={motion.opacity.to((v) => v * (chosen || stronger ? 0.85 : 0.26))} />
          </RoundedBox>
          <mesh position={[0, 0, -0.2]} scale={[slot * 0.97, 1.95, 1]}>
            <planeGeometry />
            <meshBasicMaterial color={props.palette.light} transparent opacity={chosen || stronger ? 0.055 : 0.012} depthWrite={false} />
          </mesh>
          <Line points={[[-slot * 0.32, -0.56, 0.135], [slot * 0.32, -0.56, 0.135]]} color={props.palette.edge} transparent opacity={chosen ? 0.7 : 0.15} lineWidth={0.8} />
        </animated.group>
      </animated.group>
    </Float>
  );
}

function Field(props: ChamberProps) {
  const [pulse, api] = useSpring(() => ({ scale: 0.85, opacity: 0 }));
  useEffect(() => {
    api.start({ from: { scale: 0.8, opacity: 0.14 }, to: { scale: 1.8, opacity: 0 }, immediate: props.reduced, config: { duration: 600 } });
  }, [api, props.beatKey, props.reduced]);
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[-3, 4, 6]} intensity={3.5} color={props.palette.edge} />
      <pointLight position={[4, -2, 4]} intensity={24} color={props.palette.light} />
      <pointLight position={[0, 3, 1]} intensity={12} color={props.palette.edge} />
      <animated.mesh scale={pulse.scale} position={[0, 0, -0.6]}>
        <ringGeometry args={[2.5, 2.51, 80]} />
        <animated.meshBasicMaterial color={props.palette.edge} transparent opacity={pulse.opacity} />
      </animated.mesh>
      {props.words.map((word, index) => <WordObject key={word} {...props} index={index} />)}
      {props.tier === 'full' && !props.reduced && props.locked && <Sparkles count={12} scale={[9, 2, 1]} size={1.2} speed={0.1} opacity={0.2} color={props.palette.edge} />}
    </>
  );
}

export default function SemanticChamber(props: ChamberProps) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 92 }} dpr={props.tier === 'full' ? [1, 1.75] : 1}
      gl={{ antialias: props.tier === 'full', alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.chamber = 'ready';
        gl.domElement.addEventListener('webglcontextlost', props.onUnavailable, { once: true });
      }}
      fallback={<span>Word field available below.</span>}
    >
      <Field {...props} />
    </Canvas>
  );
}
