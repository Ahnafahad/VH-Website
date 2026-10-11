'use client';

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Clone, Environment, Float, Lightformer, RoundedBox, Sparkles, useGLTF } from '@react-three/drei';
import { animated, useSpring, type SpringValue } from '@react-spring/three';
import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { assetUrl, type AssetUrls } from '../assets/runtime';
import { springs, type PresentationTier } from './tokens';

/**
 * Visual layer only. Every prop is derived from machine state; nothing here reports back into the game.
 * `best` is non-null only after judgment, so the scene can never reveal the answer early (§17.3).
 */
export type ChamberProps = {
  words: string[];
  selected: string | null;
  locked: boolean;
  best: string | null;
  missed: boolean;
  beat: number;
  beatKey: string;
  reduced: boolean;
  tier: Exclude<PresentationTier, 'lite'>;
  tilt: SpringValue<number>;
  assets: AssetUrls;
  onUnavailable: () => void;
};

const CRIMSON = new Color('#E63946');
const GOLD = new Color('#F4A828');
const IVORY = '#F5F5F5';

/** A failed asset load falls back to its procedural placeholder instead of breaking the scene. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function Model({ url, fallback, children }: { url: string | null; fallback: ReactNode; children: (scene: Object3D) => ReactNode }) {
  if (!url) return <>{fallback}</>;
  return <Fallback fallback={fallback}><Suspense fallback={fallback}><Loaded url={url}>{children}</Loaded></Suspense></Fallback>;
}
function Loaded({ url, children }: { url: string; children: (scene: Object3D) => ReactNode }) {
  const { scene } = useGLTF(url, false, false);
  return <>{children(scene)}</>;
}

/** Each tile gets its own copy so tinting one rim never lights another (Standard shares rim/body material). */
function GltfTile({ scene, glow, color, width }: { scene: Object3D; glow: number; color: Color; width: number }) {
  const clone = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(node => {
      if (node instanceof Mesh) node.material = (node.material as MeshStandardMaterial).clone();
    });
    return copy;
  }, [scene]);
  useEffect(() => {
    const rim = clone.getObjectByName('tile_rim');
    rim?.traverse(node => {
      if (node instanceof Mesh) {
        const material = node.material as MeshStandardMaterial;
        material.emissive = color;
        material.emissiveIntensity = glow;
      }
    });
  }, [clone, glow, color]);
  return <primitive object={clone} scale={[width, width, width]} />;
}

function ProceduralTile({ width, glow, color, tier }: { width: number; glow: number; color: Color; tier: ChamberProps['tier'] }) {
  return (
    <group scale={[width, width, width]}>
      <RoundedBox args={[1, 1.4, 0.2]} radius={0.07} smoothness={tier === 'full' ? 5 : 3}>
        <meshPhysicalMaterial color="#1A1A1A" metalness={0.55} roughness={0.42} clearcoat={tier === 'full' ? 0.6 : 0} clearcoatRoughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.101]}>
        <planeGeometry args={[0.9, 1.3]} />
        <meshStandardMaterial color="#161616" roughness={0.85} metalness={0.1} emissive={color} emissiveIntensity={glow * 0.08} />
      </mesh>
    </group>
  );
}

function WordTile({ index, props }: { index: number; props: ChamberProps }) {
  const viewport = useThree(state => state.viewport);
  const slot = viewport.width / props.words.length;
  // Fit inside the DOM button it sits behind; selected tiles come forward (z) so they need headroom.
  const width = Math.min(slot * 0.6, (viewport.height * 0.66) / 1.4);
  const homeX = (index - (props.words.length - 1) / 2) * slot;
  const word = props.words[index];
  const chosen = word === props.selected;
  const stronger = props.best === word;
  const rejected = props.best !== null && chosen && !stronger;
  const [motion, api] = useSpring(() => ({ x: homeX, y: 0, z: 0, ry: 0, scale: 1 }));

  useEffect(() => {
    // Magnetic pull = selected; snap = locked; after judgment the stronger word comes forward (§18.1, §40).
    const target = {
      x: homeX,
      y: stronger && props.best ? 0.06 : 0,
      z: stronger ? 0.5 : props.locked && chosen ? 0.45 : chosen ? 0.25 : 0,
      ry: chosen || stronger ? 0 : -Math.sign(homeX) * 0.12,
      scale: rejected ? 0.96 : 1,
    };
    api.start({
      to: rejected && props.missed && !props.reduced ? [{ ...target, z: 0.6 }, { ...target, z: -0.12 }, target] : target,
      immediate: props.reduced,
      config: props.locked ? springs.lock : springs.selection,
    });
  }, [api, homeX, chosen, stronger, rejected, props.best, props.locked, props.missed, props.reduced, props.beatKey]);

  const glow = stronger ? 1.2 : chosen ? (props.locked ? 1 : 0.6) : 0;
  const color = stronger ? GOLD : CRIMSON;
  const fallback = <ProceduralTile width={width} glow={glow} color={color} tier={props.tier} />;
  return (
    <Float enabled={!props.reduced && !props.selected} speed={1.1} rotationIntensity={0} floatIntensity={0.08} floatingRange={[-0.012, 0.012]}>
      <animated.group position-x={motion.x} position-y={motion.y} position-z={motion.z} rotation-y={motion.ry} scale={motion.scale}>
        <animated.group rotation-x={props.tilt.to(v => v * -0.03)}>
          <Model url={assetUrl(props.assets, props.tier === 'full' ? 'model.word-tile.full' : 'model.word-tile.standard')} fallback={fallback}>
            {scene => <GltfTile scene={scene} glow={glow} color={color} width={width} />}
          </Model>
          {props.locked && chosen && <LockRing width={width} props={props} />}
        </animated.group>
      </animated.group>
    </Float>
  );
}

/** The Seal (ASSETS_NEEDED A2): a ring closes from 112% to 100% around the locked tile. */
function LockRing({ width, props }: { width: number; props: ChamberProps }) {
  const { s } = useSpring({ from: { s: props.reduced ? 1 : 1.12 }, to: { s: 1 }, config: springs.lock, immediate: props.reduced });
  const fallback = (
    <mesh>
      <ringGeometry args={[0.98, 1, 64]} />
      <meshBasicMaterial color={CRIMSON} transparent opacity={0.5} />
    </mesh>
  );
  return (
    <animated.group scale={s.to(v => v * width)}>
      <Model url={assetUrl(props.assets, 'model.lock-ring')} fallback={<group scale={[0.65, 0.85, 1]}>{fallback}</group>}>
        {scene => <Clone object={scene} />}
      </Model>
    </animated.group>
  );
}

/** The Fulcrum: tilts toward the current selection (never the answer) and releases on every new beat. */
function Fulcrum({ props }: { props: ChamberProps }) {
  const viewport = useThree(state => state.viewport);
  const index = props.selected ? props.words.indexOf(props.selected) : -1;
  const lean = index < 0 ? 0 : (index - (props.words.length - 1) / 2) / Math.max(1, props.words.length - 1);
  const { rz } = useSpring({ rz: props.reduced ? 0 : -lean * 0.08, config: springs.settle, immediate: props.reduced });
  const length = viewport.width * 0.8;
  return (
    <animated.group position={[0, -viewport.height * 0.42, 0.2]} rotation-z={rz} scale={[length / 3, 1, 1]}>
      <Model url={assetUrl(props.assets, 'model.fulcrum')} fallback={<mesh><boxGeometry args={[3, 0.01, 0.01]} /><meshBasicMaterial color={IVORY} /></mesh>}>
        {scene => <Clone object={scene} />}
      </Model>
    </animated.group>
  );
}

/** Evidence strata: one text-free glass pane per earlier beat, receding behind the field. */
function EvidencePanes({ props }: { props: ChamberProps }) {
  const viewport = useThree(state => state.viewport);
  const panes = Math.min(props.beat, 4);
  return (
    <group position={[0, viewport.height * 0.18, -1.2]}>
      {Array.from({ length: panes }, (_, i) => (
        <group key={i} position={[0, i * 0.12, -i * 0.5]} scale={(viewport.width * 0.55) / 1.6}>
          <Model url={assetUrl(props.assets, 'model.evidence-pane')} fallback={<mesh><planeGeometry args={[1.6, 0.9]} /><meshStandardMaterial color="#20262A" transparent opacity={0.3} /></mesh>}>
            {scene => <Clone object={scene} />}
          </Model>
        </group>
      ))}
    </group>
  );
}

function Chamber(props: ChamberProps) {
  const env = props.tier === 'full' ? assetUrl(props.assets, 'envmap.chamber') : null;
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[-5, 5, 6]} intensity={2.4} color={IVORY} />
      <directionalLight position={[5, -4, -2]} intensity={0.5} color={CRIMSON} />
      {env ? (
        <Suspense fallback={null}><Environment files={env} environmentIntensity={0.25} /></Suspense>
      ) : (
        <Environment resolution={64} environmentIntensity={0.4}>
          <Lightformer form="rect" intensity={3} position={[-4, 4, 4]} scale={[4, 2, 1]} color={IVORY} />
          <Lightformer form="rect" intensity={0.6} position={[4, -3, 2]} scale={[1, 3, 1]} color="#E63946" />
        </Environment>
      )}
      {!props.reduced && <EvidencePanes props={props} />}
      {props.words.map((word, index) => <WordTile key={word} index={index} props={props} />)}
      <Fulcrum props={props} />
      {props.tier === 'full' && !props.reduced && props.locked && <Sparkles count={14} scale={[8, 2, 1]} size={1.2} speed={0.12} opacity={0.25} color={props.best ? GOLD : IVORY} />}
    </>
  );
}

export default function SemanticChamber(props: ChamberProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 28 }}
      dpr={props.tier === 'full' ? [1, 1.75] : 1}
      frameloop={props.reduced ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.chamber = 'ready';
        gl.domElement.addEventListener('webglcontextlost', props.onUnavailable, { once: true });
      }}
    >
      <Chamber {...props} />
    </Canvas>
  );
}

/**
 * Layer 0 (§17.1): the chamber shell as a full-screen, static backdrop behind the page. It renders on
 * demand only (one frame per resize), so the second context costs almost nothing. No shell file → the
 * backdrop image is used instead (CSS).
 */
export function ChamberBackdrop({ tier, assets }: { tier: ChamberProps['tier']; assets: AssetUrls }) {
  const shell = assetUrl(assets, tier === 'full' ? 'model.chamber-shell.full' : 'model.chamber-shell.standard');
  if (!shell) return null;
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 28 }} dpr={1} frameloop="demand" gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[-5, 5, 6]} intensity={1.6} color={IVORY} />
      <directionalLight position={[5, -4, 2]} intensity={0.5} color={CRIMSON} />
      <Model url={shell} fallback={null}>{scene => <Clone object={scene} />}</Model>
    </Canvas>
  );
}