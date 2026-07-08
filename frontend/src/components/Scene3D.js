import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function smoothstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
function setOpacity(group, o) {
  if (!group) return;
  group.visible = o > 0.01;
  group.traverse((c) => { if (c.material) { c.material.transparent = true; c.material.opacity = o; } });
}

function Scene({ progress }) {
  const room = useRef();
  const phone = useRef();
  const globe = useRef();
  const globeRing = useRef();

  useFrame((state) => {
    const p = progress.current;
    const time = state.clock.elapsedTime;

    const roomO = 1 - smoothstep(0.24, 0.4, p);
    const phoneO = smoothstep(0.26, 0.4, p) * (1 - smoothstep(0.62, 0.76, p));
    const globeO = smoothstep(0.64, 0.8, p);

    setOpacity(room.current, roomO);
    setOpacity(phone.current, phoneO);
    setOpacity(globe.current, globeO);

    if (room.current) {
      room.current.rotation.y = Math.sin(time * 0.2) * 0.25;
      room.current.position.y = -0.2 + Math.sin(time * 0.6) * 0.08 + p * 2.2;
    }
    if (phone.current) {
      phone.current.rotation.y = -0.35 + Math.sin(time * 0.4) * 0.18;
      phone.current.rotation.z = Math.sin(time * 0.5) * 0.04;
      phone.current.position.y = Math.sin(time * 0.7) * 0.1 + (p - 0.5) * 1.6;
    }
    if (globe.current) {
      globe.current.rotation.y = time * 0.25;
      globe.current.position.y = -0.5 + (p - 1) * 1.4 + Math.sin(time * 0.5) * 0.08;
    }
    if (globeRing.current) globeRing.current.rotation.z = time * 0.35;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 5, 4]} intensity={40} color="#ffd9a8" />
      <pointLight position={[-5, 2, 3]} intensity={22} color="#C05A46" />
      <pointLight position={[0, -3, 4]} intensity={14} color="#1E564C" />

      {/* Room / family diorama */}
      <group ref={room} position={[0.5, 0, 0]}>
        <mesh position={[0, -1.1, 0]}><boxGeometry args={[3.2, 0.3, 1.6]} /><meshStandardMaterial color="#b06a3f" roughness={0.7} /></mesh>
        <mesh position={[-1, -0.35, 0]}><boxGeometry args={[0.9, 1.1, 0.9]} /><meshStandardMaterial color="#C05A46" roughness={0.6} /></mesh>
        <mesh position={[-1, 0.35, -0.4]}><boxGeometry args={[0.9, 0.9, 0.15]} /><meshStandardMaterial color="#A64D3B" roughness={0.6} /></mesh>
        <mesh position={[0.9, 0.5, -0.2]} rotation={[0, -0.3, 0.05]}><boxGeometry args={[0.9, 1.15, 0.06]} /><meshStandardMaterial color="#F9F6F0" emissive="#ffd9a8" emissiveIntensity={0.35} roughness={0.4} /></mesh>
        <mesh position={[0.2, 1.1, -0.5]} rotation={[0, 0.2, -0.08]}><boxGeometry args={[0.7, 0.9, 0.05]} /><meshStandardMaterial color="#ffffff" emissive="#ffcaa0" emissiveIntensity={0.3} roughness={0.4} /></mesh>
        <mesh position={[0.2, -0.55, 0.5]}><cylinderGeometry args={[0.16, 0.12, 0.22, 20]} /><meshStandardMaterial color="#1E564C" roughness={0.5} /></mesh>
      </group>

      {/* Phone + chat bubbles */}
      <group ref={phone} position={[0.5, 0, 0]} visible={false}>
        <mesh><boxGeometry args={[1.5, 3, 0.18]} /><meshStandardMaterial color="#20302b" roughness={0.35} metalness={0.3} /></mesh>
        <mesh position={[0, 0, 0.1]}><boxGeometry args={[1.32, 2.8, 0.05]} /><meshStandardMaterial color="#1E564C" emissive="#1E564C" emissiveIntensity={0.35} roughness={0.2} /></mesh>
        <mesh position={[-0.28, 0.75, 0.16]}><boxGeometry args={[0.8, 0.42, 0.05]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} /></mesh>
        <mesh position={[0.32, 0.05, 0.16]}><boxGeometry args={[0.78, 0.42, 0.05]} /><meshStandardMaterial color="#25D366" emissive="#25D366" emissiveIntensity={0.35} /></mesh>
        <mesh position={[-0.28, -0.65, 0.16]}><boxGeometry args={[0.82, 0.42, 0.05]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} /></mesh>
      </group>

      {/* Globe / connection */}
      <group ref={globe} position={[0, -0.5, 0]} visible={false}>
        <mesh><icosahedronGeometry args={[1.5, 2]} /><meshStandardMaterial color="#1E564C" emissive="#1E564C" emissiveIntensity={0.25} wireframe roughness={0.4} /></mesh>
        <mesh><sphereGeometry args={[1.46, 32, 32]} /><meshStandardMaterial color="#0f332d" roughness={0.6} transparent opacity={0.5} /></mesh>
        <group ref={globeRing}>
          <mesh rotation={[Math.PI / 2.2, 0.3, 0]}><torusGeometry args={[2.1, 0.02, 12, 80]} /><meshStandardMaterial color="#C05A46" emissive="#C05A46" emissiveIntensity={0.6} /></mesh>
        </group>
        <mesh position={[1.2, 0.9, 0.6]}><sphereGeometry args={[0.09, 16, 16]} /><meshStandardMaterial color="#ffd9a8" emissive="#ffd9a8" emissiveIntensity={0.9} /></mesh>
        <mesh position={[-1.3, -0.6, 0.5]}><sphereGeometry args={[0.09, 16, 16]} /><meshStandardMaterial color="#25D366" emissive="#25D366" emissiveIntensity={0.9} /></mesh>
      </group>
    </>
  );
}

export function Scene3D({ progress }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: "none" }}>
      <Scene progress={progress} />
    </Canvas>
  );
}
