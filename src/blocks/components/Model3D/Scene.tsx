'use client'

/**
 * The only module in the codebase that may import three.js or @react-three/*.
 * It is reached exclusively via `next/dynamic(..., { ssr: false })` in
 * ./Client.tsx, so nothing here ever runs on the server or is bundled into
 * pages that do not contain a model3d block.
 */
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import type { Mesh } from 'three'

type SceneProps = {
  autoRotate: boolean
  url: null | string
}

// Palette (mirrors the design tokens in globals.css — three.js needs raw hex).
const GOLD = '#c9a84c' // gold-400
const STONE = '#8d8468' // ink-400
const STONE_LIGHT = '#d9cba6' // parchment-300

function GltfModel({ url }: { url: string }) {
  const gltf = useGLTF(url)
  // Clone so the same cached .glb can appear in several blocks on one page.
  const object = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  return <primitive object={object} />
}

/** Spinning wireframe shown inside the canvas while the .glb streams in. */
function LoadingGem() {
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.8
  })
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color={STONE_LIGHT} wireframe />
    </mesh>
  )
}

/**
 * Built-in exhibit for blocks without a model: a slowly turning gilded
 * icosahedron on a stepped stone plinth.
 */
function PlaceholderMonument() {
  const gem = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (gem.current) gem.current.rotation.y += delta * 0.4
  })
  return (
    <group position={[0, -0.55, 0]}>
      <mesh>
        <boxGeometry args={[1.9, 0.28, 1.9]} />
        <meshStandardMaterial color={STONE} metalness={0.05} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[1.35, 0.24, 1.35]} />
        <meshStandardMaterial color={STONE_LIGHT} metalness={0.05} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 0]} ref={gem}>
        <icosahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial color={GOLD} flatShading metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

export default function Scene({ url, autoRotate }: SceneProps) {
  // Auto-rotation stops for good the moment the visitor takes the controls.
  const [rotate, setRotate] = useState(autoRotate)

  return (
    <Canvas
      camera={{ fov: 42, position: [4, 3, 6] }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight intensity={1.2} position={[5, 8, 4]} />
      <directionalLight intensity={0.35} position={[-6, 4, -5]} />
      <Suspense fallback={<LoadingGem />}>
        {url ? (
          <Bounds clip fit margin={1.2} observe>
            <Center>
              <GltfModel url={url} />
            </Center>
          </Bounds>
        ) : (
          <PlaceholderMonument />
        )}
      </Suspense>
      <OrbitControls
        autoRotate={rotate}
        autoRotateSpeed={0.8}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={30}
        minDistance={1.2}
        onStart={() => setRotate(false)}
        target={[0, 0.3, 0]}
      />
    </Canvas>
  )
}
