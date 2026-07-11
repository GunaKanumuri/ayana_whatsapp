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
        {/* Floor / rug */}
        <mesh position={[0, -1.1, 0]}><boxGeometry args={[3.4, 0.3, 1.7]} /><meshStandardMaterial color="#b06a3f" roughness={0.7} /></mesh>

        {/* Classic armchair: seat + backrest + arms + legs */}
        <group position={[-1.05, -0.55, 0.05]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[0.95, 0.32, 0.85]} /><meshStandardMaterial color="#C05A46" roughness={0.55} /></mesh>
          <mesh position={[0, 0.6, -0.32]} rotation={[-0.12, 0, 0]}><boxGeometry args={[0.95, 0.9, 0.18]} /><meshStandardMaterial color="#A64D3B" roughness={0.55} /></mesh>
          <mesh position={[-0.44, 0.2, 0.05]}><boxGeometry args={[0.14, 0.5, 0.75]} /><meshStandardMaterial color="#A64D3B" roughness={0.55} /></mesh>
          <mesh position={[0.44, 0.2, 0.05]}><boxGeometry args={[0.14, 0.5, 0.75]} /><meshStandardMaterial color="#A64D3B" roughness={0.55} /></mesh>
          {[[-0.35,-0.42,-0.3],[0.35,-0.42,-0.3],[-0.35,-0.42,0.3],[0.35,-0.42,0.3]].map((p,i)=>(
            <mesh key={i} position={p}><cylinderGeometry args={[0.05,0.05,0.22,10]} /><meshStandardMaterial color="#3a2a20" roughness={0.7} /></mesh>
          ))}
        </group>

        {/* Side table with tea cup */}
        <group position={[0.05, -0.62, 0.55]}>
          <mesh><cylinderGeometry args={[0.32, 0.32, 0.06, 24]} /><meshStandardMaterial color="#8a5a3a" roughness={0.6} /></mesh>
          <mesh position={[0, -0.28, 0]}><cylinderGeometry args={[0.05, 0.05, 0.5, 10]} /><meshStandardMaterial color="#5c3d28" roughness={0.7} /></mesh>
          <group position={[0, 0.16, 0]}>
            <mesh><cylinderGeometry args={[0.15, 0.11, 0.2, 20]} /><meshStandardMaterial color="#1E564C" roughness={0.4} /></mesh>
            <mesh position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.07, 0.02, 8, 16]} /><meshStandardMaterial color="#1E564C" roughness={0.4} /></mesh>
          </group>
        </group>

        {/* Leaning family photo frames (frame + warm inset "photo") */}
        <group position={[0.95, 0.45, -0.25]} rotation={[0, -0.32, 0.06]}>
          <mesh><boxGeometry args={[0.85, 1.1, 0.06]} /><meshStandardMaterial color="#F9F6F0" roughness={0.5} /></mesh>
          <mesh position={[0, 0, 0.035]}><boxGeometry args={[0.68, 0.9, 0.02]} /><meshStandardMaterial color="#e8b98f" emissive="#ffb877" emissiveIntensity={0.4} roughness={0.4} /></mesh>
        </group>
        <group position={[0.35, 1.05, -0.5]} rotation={[0, 0.22, -0.07]}>
          <mesh><boxGeometry args={[0.68, 0.88, 0.06]} /><meshStandardMaterial color="#ffffff" roughness={0.5} /></mesh>
          <mesh position={[0, 0, 0.035]}><boxGeometry args={[0.52, 0.68, 0.02]} /><meshStandardMaterial color="#f0c9a0" emissive="#ffcaa0" emissiveIntensity={0.35} roughness={0.4} /></mesh>
        </group>

        {/* Small plant for warmth */}
        <group position={[1.15, -0.75, 0.65]}>
          <mesh><cylinderGeometry args={[0.12, 0.09, 0.2, 16]} /><meshStandardMaterial color="#1E564C" roughness={0.6} /></mesh>
          {[[0,0.05,0],[0.06,0.08,0.04],[-0.05,0.1,-0.03]].map((p,i)=>(
            <mesh key={i} position={[p[0], 0.18+p[1], p[2]]} rotation={[0.3,i,0.2]}><coneGeometry args={[0.05,0.28,8]} /><meshStandardMaterial color="#2f6b4a" roughness={0.6} /></mesh>
          ))}
        </group>
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