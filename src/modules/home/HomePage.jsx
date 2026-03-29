import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence, useMotionValue, useAnimation } from "framer-motion";
import * as THREE from "three";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
/* ─── DESIGN TOKENS ──────────────────────────────────────────── */
const T = {
    bg: "var(--bg)",
    surface: "var(--surface)",
    surfaceHigh: "var(--surface-high)",
    glass: "var(--glass)",
    primary: "var(--primary)",
    primaryLight: "var(--primary-light)",
    primaryGlow: "var(--primary-glow)",
    gold: "var(--accent)",
    goldLight: "var(--accent-light)",
    goldGlow: "var(--accent-glow)",
    text: "var(--text)",
    textMid: "var(--text-mid)",
    textMuted: "var(--text-muted)",
    border: "var(--border)",
    borderGold: "rgba(184,106,0,0.2)",
};

/* ─── GLOBAL STYLES ──────────────────────────────────────────── */
const GlobalStyle = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&display=swap');
    
    body{background:var(--bg);color:var(--text);font-family:var(--font-sans);overflow-x:hidden;cursor:default}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-track{background:var(--bg)}
    ::-webkit-scrollbar-thumb{background:var(--primary);border-radius:2px}

    .cursor-dot{width:8px;height:8px;background:${T.primary};border-radius:50%;position:fixed;top:0;left:0;pointer-events:none;z-index:9999;opacity:0.72;mix-blend-mode:multiply;box-shadow:0 0 18px ${T.primaryGlow}}
    .cursor-ring{width:34px;height:34px;border:1px solid color-mix(in srgb, var(--primary) 32%, transparent);border-radius:50%;position:fixed;top:0;left:0;pointer-events:none;z-index:9998;opacity:0.55;transition:width 0.2s,height 0.2s,border-color 0.2s,opacity 0.2s}
    .cursor-ring.hover{width:54px;height:54px;border-color:color-mix(in srgb, var(--primary) 55%, transparent);opacity:0.85}

    .grid-bg{background-image:linear-gradient(rgba(0,85,187,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,85,187,0.05) 1px,transparent 1px);background-size:56px 56px}

    .tag{display:inline-block;border:1px solid color-mix(in srgb, var(--primary) 22%, transparent);color:var(--primary);font-family:var(--font-mono);font-size:10px;letter-spacing:3px;padding:7px 14px;text-transform:uppercase;background:color-mix(in srgb, var(--primary) 9%, transparent);border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.14)}
    
    .btn-primary{position:relative;overflow:hidden;background:color-mix(in srgb, var(--primary) 12%, transparent);border:1px solid color-mix(in srgb, var(--primary) 34%, transparent);color:var(--primary);padding:14px 38px;font-family:var(--font-heading);font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:color 0.3s,box-shadow 0.3s,transform 0.3s;border-radius:18px}
    .btn-primary::before{content:'';position:absolute;inset:0;background:var(--primary);transform:translateX(-101%);transition:transform 0.35s ease;z-index:0}
    .btn-primary span{position:relative;z-index:1}
    .btn-primary:hover{color:#fff;transform:translateY(-2px);box-shadow:0 18px 34px color-mix(in srgb, var(--primary) 24%, transparent)}
    .btn-primary:hover::before{transform:translateX(0)}

    .btn-gold{position:relative;overflow:hidden;background:color-mix(in srgb, var(--accent) 12%, transparent);border:1px solid color-mix(in srgb, var(--accent) 30%, transparent);color:var(--accent);padding:14px 38px;font-family:var(--font-heading);font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:color 0.3s,box-shadow 0.3s,transform 0.3s;border-radius:18px}
    .btn-gold::before{content:'';position:absolute;inset:0;background:var(--accent);transform:translateX(-101%);transition:transform 0.35s ease;z-index:0}
    .btn-gold span{position:relative;z-index:1}
    .btn-gold:hover{color:#fff;transform:translateY(-2px);box-shadow:0 18px 34px color-mix(in srgb, var(--accent) 22%, transparent)}
    .btn-gold:hover::before{transform:translateX(0)}

    .feat-card{border:1px solid color-mix(in srgb, var(--border) 90%, transparent);background:linear-gradient(180deg,color-mix(in srgb, var(--bg-surface) 68%, transparent),color-mix(in srgb, var(--surface) 96%, transparent));backdrop-filter:blur(16px) saturate(150%);padding:32px;position:relative;overflow:hidden;transition:border-color 0.35s,transform 0.35s,box-shadow 0.35s;border-radius:24px;box-shadow:0 18px 40px rgba(15,23,42,0.08),inset 0 1px 0 rgba(255,255,255,0.18)}
    .feat-card::after{content:'';position:absolute;top:0;left:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,${T.primary},transparent);opacity:0.55;transition:opacity 0.35s}
    .feat-card:hover{border-color:color-mix(in srgb, var(--primary) 24%, transparent);transform:translateY(-6px);box-shadow:0 24px 64px rgba(15,23,42,0.14),0 0 0 1px color-mix(in srgb, var(--primary) 7%, transparent)}
    .feat-card:hover::after{opacity:1}

    @keyframes scanline{0%{top:-2px}100%{top:102%}}
    @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
    @keyframes float-up{0%{transform:translateY(0);opacity:0.6}100%{transform:translateY(-120px);opacity:0}}
    @keyframes grid-shift{0%{background-position:0 0}100%{background-position:56px 56px}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

    .section-line{height:1px;background:linear-gradient(90deg,transparent,rgba(0,85,187,0.2),transparent)}
    @media (hover:none),(pointer:coarse){.cursor-dot,.cursor-ring{display:none}}
    @media(max-width:768px){.hide-mobile{display:none!important}.grid-2{grid-template-columns:1fr!important}.grid-4{grid-template-columns:repeat(2,1fr)!important}}
  `}</style>
);

/* ─── CUSTOM CURSOR ──────────────────────────────────────────── */
const Cursor = () => {
    const dotRef = useRef(null);
    const ringRef = useRef(null);
    useEffect(() => {
        let x = 0, y = 0, rx = 0, ry = 0;
        const move = (e) => { x = e.clientX; y = e.clientY; };
        const over = (e) => {
            if (e.target.closest('button,a,.feat-card,.node')) ringRef.current?.classList.add('hover');
            else ringRef.current?.classList.remove('hover');
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseover", over);
        let raf;
        const animate = () => {
            rx += (x - rx) * 0.12; ry += (y - ry) * 0.12;
            if (dotRef.current) dotRef.current.style.transform = `translate(${x - 3.5}px,${y - 3.5}px)`;
            if (ringRef.current) ringRef.current.style.transform = `translate(${rx - 15}px,${ry - 15}px)`;
            raf = requestAnimationFrame(animate);
        };
        animate();
        return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); cancelAnimationFrame(raf); };
    }, []);
    return (<><div className="cursor-dot" ref={dotRef} /><div className="cursor-ring" ref={ringRef} /></>);
};

/* ─── REALISTIC THREE.JS BUILDING SCENE ─────────────────────── */
const BuildingScene = ({ scrollY, theme }) => {
    const canvasRef = useRef(null);
    const smoothScroll = useSpring(scrollY, { stiffness: 30, damping: 20 });
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const W = canvas.clientWidth, H = canvas.clientHeight;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H, false);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = isDark ? 0.85 : 1.2;

        const scene = new THREE.Scene();
        // Sky gradient fog - adjust for theme
        scene.fog = new THREE.FogExp2(isDark ? 0x050a15 : 0xe8f2ff, 0.018);

        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 800);
        camera.position.set(0, 12, 45);
        camera.lookAt(0, 2, 0);

        // ── LIGHTING SETUP ────────────────────────────────────────
        // Sky light (hemisphere)
        const hemi = new THREE.HemisphereLight(
            isDark ? 0x1a2a44 : 0xddeeff, 
            isDark ? 0x050a15 : 0xc8d8e8, 
            isDark ? 0.8 : 1.8
        );
        scene.add(hemi);

        // Sun directional
        const sunColor = isDark ? 0x3b82f6 : 0xfff5e0;
        const sunIntensity = isDark ? 1.5 : 3.5;
        const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
        sun.position.set(30, 60, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        scene.add(sun);

        // Bounce light
        const bounce = new THREE.DirectionalLight(isDark ? 0x1a2a44 : 0x8bb8e8, isDark ? 0.5 : 1.2);
        bounce.position.set(-20, 10, -10);
        scene.add(bounce);

        // Street level warm point lights
        const warmPt1 = new THREE.PointLight(0xffaa44, isDark ? 4.5 : 2.5, 30);
        warmPt1.position.set(-5, 1, 8);
        scene.add(warmPt1);
        const warmPt2 = new THREE.PointLight(0x4488ff, isDark ? 3.0 : 2.0, 25);
        warmPt2.position.set(12, 2, 5);
        scene.add(warmPt2);

        //Realistic glass curtain-wall material
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: isDark ? 0x1a3a5a : 0xc8ddf0, metalness: 0.1, roughness: 0.05,
            transmission: 0.3, thickness: 0.5,
            reflectivity: 0.9, envMapIntensity: 1.5,
        });

        // Concrete / stone base material
        const concreteMat = new THREE.MeshStandardMaterial({
            color: isDark ? 0x1a1a1a : 0xd0d8e0, metalness: 0.05, roughness: 0.85,
        });

        // Brushed steel cladding
        const steelMat = new THREE.MeshStandardMaterial({
            color: isDark ? 0x2a2a2a : 0xb8ccd8, metalness: 0.75, roughness: 0.25,
        });

        // Dark glass (modern tower)
        const darkGlass = new THREE.MeshPhysicalMaterial({
            color: isDark ? 0x050505 : 0x3a5a70, metalness: 0.2, roughness: 0.1,
            transmission: 0.25, reflectivity: 0.95,
        });

        // Gold accent (facade fins)
        const goldMat = new THREE.MeshStandardMaterial({
            color: 0xc8922a, metalness: 0.88, roughness: 0.15,
            emissive: 0xb07820, emissiveIntensity: 0.12,
        });

        // Window glow material
        const windowGlow = new THREE.MeshStandardMaterial({
            color: 0xffffcc, emissive: 0xffe08a, emissiveIntensity: 1.2,
            metalness: 0.0, roughness: 0.5,
        });

        // ── BUILDING FACTORY ──────────────────────────────────────
        const buildings = [];

        // Helper: Add horizontal window bands to a building
        const addWindowBands = (parent, w, h, d, floors, type = 'glass') => {
            const floorH = h / floors;
            for (let f = 2; f < floors; f++) {
                const winW = w * (type === 'glass' ? 0.88 : 0.7);
                const winH = floorH * 0.55;
                const geo = new THREE.BoxGeometry(winW, winH, d * 0.05);
                const mat = Math.random() > 0.3 ? windowGlow.clone() : glassMat.clone();
                if (mat.emissive) mat.emissiveIntensity = 0.6 + Math.random() * 0.8;
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(0, -h / 2 + floorH * f + winH / 2, d / 2 + 0.05);
                parent.add(mesh);
                // Back face
                const meshB = mesh.clone();
                meshB.position.z = -d / 2 - 0.05;
                parent.add(meshB);
            }
        };

        // Helper: Add vertical facade fins
        const addFins = (parent, w, h, spacing, mat) => {
            const count = Math.floor(w / spacing);
            for (let i = 0; i <= count; i++) {
                const geo = new THREE.BoxGeometry(0.06, h * 0.95, 0.5);
                const fin = new THREE.Mesh(geo, mat);
                fin.position.set(-w / 2 + i * spacing, 0, 0);
                parent.add(fin);
            }
        };

        // Helper: Stepped pyramid roof
        const addSteppedRoof = (parent, w, d, h, steps, mat) => {
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                const sw = w * (1 - t * 0.65);
                const sd = d * (1 - t * 0.65);
                const sh = h / steps;
                const geo = new THREE.BoxGeometry(sw, sh, sd);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(0, h / 2 - s * sh + sh * (steps - 1) / 2 + sh * s * 0.05, 0);
                parent.add(mesh);
            }
        };

        // ── BUILDING DEFINITIONS ──────────────────────────────────
        const buildingDefs = [
            // [x, z, w, d, h, type, floors]
            // LEFT CLUSTER
            { x: -32, z: -2, w: 5, d: 5, h: 8, type: 'concrete', floors: 4 },
            { x: -28, z: 2, w: 3.5, d: 3.5, h: 14, type: 'steel', floors: 8 },
            { x: -24, z: -3, w: 6, d: 5, h: 10, type: 'concrete', floors: 5 },
            { x: -20, z: 1, w: 4, d: 4, h: 22, type: 'glass', floors: 14 },
            { x: -17, z: -1, w: 3, d: 3, h: 16, type: 'steel', floors: 10 },
            { x: -14, z: 3, w: 5, d: 4, h: 12, type: 'concrete', floors: 7 },
            { x: -11, z: -2, w: 3.5, d: 3.5, h: 28, type: 'dark', floors: 18 },
            { x: -8, z: 1, w: 4.5, d: 4.5, h: 18, type: 'glass', floors: 12 },
            // CENTER TOWERS
            { x: -5, z: -2, w: 5, d: 5, h: 20, type: 'steel', floors: 13 },
            { x: -2, z: 2, w: 4, d: 4, h: 36, type: 'dark', floors: 22 },   // signature tower
            { x: 2, z: -3, w: 6, d: 5, h: 26, type: 'glass', floors: 16 },
            { x: 6, z: 0, w: 5, d: 5, h: 44, type: 'gold', floors: 28 },    // hero tower
            { x: 10, z: -2, w: 4, d: 4, h: 30, type: 'dark', floors: 19 },
            { x: 13, z: 2, w: 3.5, d: 3.5, h: 22, type: 'glass', floors: 14 },
            // RIGHT CLUSTER
            { x: 16, z: -1, w: 5, d: 4, h: 18, type: 'steel', floors: 11 },
            { x: 20, z: 1, w: 4, d: 4, h: 14, type: 'concrete', floors: 8 },
            { x: 23, z: -3, w: 3.5, d: 3, h: 20, type: 'glass', floors: 13 },
            { x: 26, z: 2, w: 5, d: 5, h: 10, type: 'concrete', floors: 6 },
            { x: 30, z: -1, w: 4, d: 4, h: 16, type: 'steel', floors: 10 },
            { x: 33, z: 2, w: 3, d: 3, h: 8, type: 'concrete', floors: 4 },
            // BACKGROUND (distant, smaller)
            { x: -38, z: -8, w: 4, d: 4, h: 6, type: 'concrete', floors: 3 },
            { x: -42, z: -5, w: 3, d: 3, h: 10, type: 'steel', floors: 6 },
            { x: -36, z: -10, w: 5, d: 4, h: 8, type: 'concrete', floors: 4 },
            { x: 38, z: -6, w: 4, d: 4, h: 9, type: 'concrete', floors: 5 },
            { x: 42, z: -8, w: 3.5, d: 3.5, h: 7, type: 'steel', floors: 4 },
        ];

        buildingDefs.forEach((def) => {
            const group = new THREE.Group();
            group.position.set(def.x, -def.h / 2 - 2, def.z); // start below ground
            group.userData = {
                targetY: def.h / 2,
                speed: 0.015 + Math.random() * 0.012,
                delay: Math.random() * 60,
                risen: 0,
                phase: Math.random() * Math.PI * 2,
            };

            let bodyMat, roofMat;
            switch (def.type) {
                case 'glass': bodyMat = glassMat.clone(); roofMat = steelMat.clone(); break;
                case 'dark': bodyMat = darkGlass.clone(); roofMat = steelMat.clone(); break;
                case 'gold': bodyMat = darkGlass.clone(); roofMat = goldMat.clone(); break;
                case 'steel': bodyMat = steelMat.clone(); roofMat = concreteMat.clone(); break;
                default: bodyMat = concreteMat.clone(); roofMat = concreteMat.clone(); break;
            }

            // Main body
            const bodyGeo = new THREE.BoxGeometry(def.w, def.h, def.d);
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Window bands
            addWindowBands(group, def.w, def.h, def.d, def.floors, def.type);

            // Type-specific details
            if (def.type === 'gold' || def.type === 'glass') {
                // Vertical fins
                addFins(body, def.w, def.h, 0.8, def.type === 'gold' ? goldMat.clone() : steelMat.clone());
            }

            if (def.type === 'dark') {
                // Horizontal ledges every few floors
                for (let f = 3; f < def.floors; f += 3) {
                    const ledgeGeo = new THREE.BoxGeometry(def.w + 0.3, 0.2, def.d + 0.3);
                    const ledge = new THREE.Mesh(ledgeGeo, steelMat.clone());
                    ledge.position.y = -def.h / 2 + (def.h / def.floors) * f;
                    group.add(ledge);
                }
            }

            // Roof structure
            if (def.h > 20) {
                // Parapet
                const parapet = new THREE.Mesh(
                    new THREE.BoxGeometry(def.w + 0.2, 0.4, def.d + 0.2),
                    steelMat.clone()
                );
                parapet.position.y = def.h / 2 + 0.2;
                group.add(parapet);

                if (def.type === 'gold') {
                    // Antenna / spire
                    const spireGeo = new THREE.CylinderGeometry(0.06, 0.15, def.h * 0.25, 8);
                    const spire = new THREE.Mesh(spireGeo, goldMat.clone());
                    spire.position.y = def.h / 2 + def.h * 0.125 + 0.4;
                    group.add(spire);
                    // Rooftop glow
                    const roofGlow = new THREE.PointLight(0xffcc44, 3, 15);
                    roofGlow.position.y = def.h / 2 + 1;
                    group.add(roofGlow);
                }

                if (def.type === 'dark') {
                    // Helipad ring
                    const ringGeo = new THREE.TorusGeometry(def.w * 0.25, 0.1, 8, 32);
                    const ring = new THREE.Mesh(ringGeo, goldMat.clone());
                    ring.rotation.x = Math.PI / 2;
                    ring.position.y = def.h / 2 + 0.5;
                    group.add(ring);
                }
            } else if (def.h < 14) {
                // Flat roof with AC units
                const acGeo = new THREE.BoxGeometry(def.w * 0.35, 0.8, def.d * 0.35);
                const ac = new THREE.Mesh(acGeo, concreteMat.clone());
                ac.position.y = def.h / 2 + 0.4;
                ac.position.x = def.w * 0.2;
                group.add(ac);
                const ac2 = ac.clone();
                ac2.position.x = -def.w * 0.2;
                group.add(ac2);
            }

            // Base / podium
            const podiumGeo = new THREE.BoxGeometry(def.w + 1.0, 1.2, def.d + 1.0);
            const podium = new THREE.Mesh(podiumGeo, concreteMat.clone());
            podium.position.y = -def.h / 2 - 0.6;
            podium.castShadow = true;
            group.add(podium);

            scene.add(group);
            buildings.push(group);
        });

        // ── GROUND PLANE ──────────────────────────────────────────
        const groundGeo = new THREE.PlaneGeometry(200, 100);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xc8d5e0, roughness: 0.95, metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        scene.add(ground);

        // Road grid
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x9aabb8, roughness: 0.9 });
        const roadGeo = new THREE.PlaneGeometry(200, 2.5);
        const road1 = new THREE.Mesh(roadGeo, roadMat);
        road1.rotation.x = -Math.PI / 2;
        road1.position.set(0, 0.02, 4);
        scene.add(road1);
        const road2 = road1.clone();
        road2.position.set(0, 0.02, -4);
        scene.add(road2);

        // Crossroad
        const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 100), roadMat);
        roadV.rotation.x = -Math.PI / 2;
        roadV.position.set(8, 0.02, 0);
        scene.add(roadV);

        // ── GRID HELPER ───────────────────────────────────────────
        const grid = new THREE.GridHelper(200, 80, 0x88aabb, 0x99b8cc);
        grid.material.opacity = 0.18;
        grid.material.transparent = true;
        grid.position.y = 0.03;
        scene.add(grid);

        // ── PARTICLES (data streams / dust motes) ─────────────────
        const PARTICLES = 350;
        const pGeo = new THREE.BufferGeometry();
        const pPos = new Float32Array(PARTICLES * 3);
        const pSpeeds = new Float32Array(PARTICLES);
        for (let i = 0; i < PARTICLES; i++) {
            pPos[i * 3] = (Math.random() - 0.5) * 80;
            pPos[i * 3 + 1] = Math.random() * 50;
            pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
            pSpeeds[i] = 0.02 + Math.random() * 0.04;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        const pMat = new THREE.PointsMaterial({
            color: 0x4488cc, size: 0.1, transparent: true, opacity: 0.55,
            sizeAttenuation: true,
        });
        const particles = new THREE.Points(pGeo, pMat);
        scene.add(particles);

        // ── LENS FLARE STAND-IN (subtle glow spheres) ─────────────
        const flareGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const flareMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.55 });
        const flare = new THREE.Mesh(flareGeo, flareMat);
        flare.position.set(30, 60, 20);
        scene.add(flare);

        // ── ANIMATION LOOP ────────────────────────────────────────
        let frame = 0;
        let animId;
        const clock = new THREE.Clock();

        const animate = () => {
            animId = requestAnimationFrame(animate);
            const dt = clock.getDelta();
            const t = clock.getElapsedTime();
            frame++;

            const scrollVal = Math.min(1, Math.max(0, smoothScroll.get()));

            // Rise buildings with staggered delay
            buildings.forEach((b) => {
                const ud = b.userData;
                if (frame < ud.delay) return;
                if (ud.risen < 1) ud.risen = Math.min(1, ud.risen + ud.speed);
                const ease = 1 - Math.pow(1 - ud.risen, 3); // easeOutCubic
                b.position.y = THREE.MathUtils.lerp(-ud.targetY - 2, ud.targetY, ease);
                // Subtle sway
                b.rotation.z = Math.sin(t * 0.15 + ud.phase) * 0.0008;
            });

            // Camera fly-through on scroll
            const camEase = scrollVal * scrollVal * (3 - 2 * scrollVal); // smoothstep
            camera.position.x = Math.sin(t * 0.04) * 3 + camEase * 12;
            camera.position.y = 12 - camEase * 5 + Math.sin(t * 0.06) * 0.8;
            camera.position.z = 45 - camEase * 30;
            camera.lookAt(
                camEase * 4,
                2 - camEase * 2 + Math.sin(t * 0.04) * 0.5,
                -camEase * 8
            );

            // Particles drift upward
            const pa = pGeo.attributes.position.array;
            for (let i = 0; i < PARTICLES; i++) {
                pa[i * 3 + 1] += pSpeeds[i] * (1 + scrollVal * 2);
                pa[i * 3] += Math.sin(t * 0.3 + i * 0.1) * 0.005;
                if (pa[i * 3 + 1] > 55) pa[i * 3 + 1] = 0;
            }
            pGeo.attributes.position.needsUpdate = true;

            // Animate lights
            warmPt1.intensity = 2.5 + Math.sin(t * 0.7) * 0.5;
            warmPt2.intensity = 2.0 + Math.sin(t * 0.9 + 1) * 0.4;
            flare.material.opacity = 0.4 + Math.sin(t * 0.5) * 0.15;

            renderer.render(scene, camera);
        };
        animate();

        // ── RESIZE ────────────────────────────────────────────────
        const handleResize = () => {
            const w = canvas.clientWidth, h = canvas.clientHeight;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", handleResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", handleResize);
            renderer.dispose();
        };
    }, [theme]);

    return (
        <canvas ref={canvasRef} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0.72,
        }} />
    );
};

/* ─── HERO ───────────────────────────────────────────────────── */
const Hero = ({ theme, stats }) => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

    return (
        <section id="platform" ref={ref} style={{
            height: "100vh", minHeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", position: "relative",
        }}>
            {/* Radial gradient overlay */}
            <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(ellipse 75% 65% at 50% 82%, rgba(0,85,187,0.07) 0%, transparent 68%)`,
                pointerEvents: "none", zIndex: 1,
            }} />
            {/* Bottom fade */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
                background: `linear-gradient(to top, ${T.bg}, transparent)`,
                pointerEvents: "none", zIndex: 2,
            }} />

            {/* CONTENT */}
            <motion.div style={{ y, opacity, position: "relative", zIndex: 10, textAlign: "center", padding: "0 24px", maxWidth: 900 }}>
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                    <span className="tag">Aluminum Formwork Intelligence Platform</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "clamp(56px, 10vw, 120px)",
                        fontWeight: 900, lineHeight: 0.92, letterSpacing: "-3px",
                        marginTop: 28, marginBottom: 6,
                        textShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 2px 10px rgba(255,255,255,0.4)',
                    }}
                >
                    <span style={{ color: T.text }}>FORM</span>
                    <span style={{ color: T.primary, textShadow: `0 0 40px ${T.primaryGlow}` }}>O</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.85 }}
                    style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "clamp(10px, 1.3vw, 13px)", color: T.textMuted,
                        letterSpacing: "4.5px", textTransform: "uppercase", marginBottom: 36,
                        textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                    }}
                >
                    ∕∕&nbsp; Precision Planning · Smart Production · Zero Waste
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 1.1 }}
                    style={{ 
                        maxWidth: 540, margin: "0 auto 48px", 
                        fontSize: "clamp(17px, 1.9vw, 21px)", color: T.textMid, 
                        lineHeight: 1.65,
                        textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                    }}
                >
                    The next-generation aluminum formwork planning suite — 2D nesting, barcode-tracked production, and AI-powered insights in one command center.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.3 }}
                    style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}
                >
                    <button className="btn-primary"><span>Launch Platform</span></button>
                    <button className="btn-gold"><span>Watch Demo</span></button>
                </motion.div>

                {/* Live stats ticker */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.8 }}
                    style={{
                        marginTop: 60,
                        display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap",
                    }}
                >
                    {[
                        [stats.itemsTracked, "Items Tracked"], 
                        [stats.bomAccuracy, "BOM Accuracy"], 
                        [stats.activeLots, "Active Lots"]
                    ].map(([v, l]) => (
                        <div key={l} style={{ textAlign: "center" }}>
                            <div style={{ fontFamily: "'Orbitron'", fontSize: 22, fontWeight: 700, color: T.primary }}>{v}</div>
                            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: T.textMuted, letterSpacing: 2.5, marginTop: 4 }}>{l}</div>
                        </div>
                    ))}
                </motion.div>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
                style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}
                animate={{ y: [0, 9, 0] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
            >
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: T.textMuted, letterSpacing: 3.5 }}>SCROLL</div>
                <div style={{ width: 1, height: 44, background: `linear-gradient(to bottom, ${T.primary}, transparent)` }} />
            </motion.div>
        </section>
    );
};

/* ─── STATS BAND ─────────────────────────────────────────────── */
const StatsBand = () => {
    const stats = [
        { val: "2D + 3D", label: "Nesting Engine", sub: "Dual-mode planning" },
        { val: "99.8%", label: "Material Accuracy", sub: "Verified across 1,200+ lots" },
        { val: "<1s", label: "BOM Calculation", sub: "Instant generation" },
        { val: "∞", label: "Production Lots", sub: "No hard limits" },
    ];
    return (
        <section style={{ background: T.surface }}>
            <div className="section-line" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }} className="grid-4">
                {stats.map((s, i) => (
                    <motion.div key={i}
                        initial={{ opacity: 0, y: 28 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                        style={{
                            padding: "36px 28px", borderRight: i < 3 ? `1px solid rgba(0,85,187,0.1)` : "none",
                            position: "relative", textAlign: "center", overflow: "hidden",
                        }}
                    >
                        <div style={{
                            position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                            background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? T.gold : T.primary}, transparent)`,
                            opacity: 0.5,
                        }} />
                        <div style={{ fontFamily: "'Orbitron'", fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 700, color: T.gold, marginBottom: 6 }}>{s.val}</div>
                        <div style={{ fontSize: 13, letterSpacing: 2, color: T.textMid, textTransform: "uppercase", fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: T.textMuted, marginTop: 5 }}>{s.sub}</div>
                    </motion.div>
                ))}
            </div>
            <div className="section-line" />
        </section>
    );
};

/* ─── FEATURES ───────────────────────────────────────────────── */
const FEATURES = [
    { icon: "⬡", title: "2D Cutting & Nesting", desc: "Advanced algorithms minimize aluminum waste. Visualize cut layouts in real-time with drag-and-drop planning.", tag: "CORE", color: T.primary },
    { icon: "◈", title: "PNL · SEC · SPL Modules", desc: "Full module coverage — Panel, Secondary, and Special components in one unified workflow.", tag: "PLANNING", color: T.gold },
    { icon: "◉", title: "Item Modification System", desc: "Dynamic editing with full version history. Modify specs, dimensions, and quantities with complete audit trail.", tag: "CONTROL", color: T.primary },
    { icon: "▦", title: "Production Reports", desc: "Line-wise and item-wise reports generated instantly. Track throughput and bottlenecks at every stage.", tag: "REPORTS", color: T.gold },
    { icon: "◎", title: "MIS & Lot Reports", desc: "Lot-wise traceability from raw material to finished formwork assembly. Instant management visibility.", tag: "MIS", color: T.primary },
    { icon: "⬙", title: "Production Analysis", desc: "Real-time KPIs, trend analysis, and predictive scheduling across all production lines.", tag: "ANALYTICS", color: T.gold },
    { icon: "◆", title: "One-Click BOM Calc", desc: "Instant raw material requirement calculation. Zero manual error — click and generate your bill of materials.", tag: "AUTOMATION", color: T.primary },
    { icon: "▣", title: "Barcode Tracking", desc: "Scan any item to see full history — IPO stage, planning assignment, user interactions and more.", tag: "TRACKING", color: T.gold },
];

const Features = () => (
    <section id="services" style={{ padding: "120px 40px", background: T.bg }} className="grid-bg">
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
            <motion.div style={{ textAlign: "center", marginBottom: 80 }}
                initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
                <span className="tag" style={{ marginBottom: 20, display: "inline-block" }}>Platform Capabilities</span>
                <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(28px, 5vw, 58px)", fontWeight: 700, lineHeight: 1.08, color: T.text, marginTop: 20 }}>
                    Every Tool You Need.<br /><span style={{ color: T.primary }}>Nothing You Don't.</span>
                </h2>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 2 }}>
                {FEATURES.map((f, i) => (
                    <motion.div key={i} className="feat-card"
                        initial={{ opacity: 0, y: 36 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: (i % 4) * 0.1 }}
                    >
                        {/* Corner cut */}
                        <div style={{ position: "absolute", top: 0, right: 0, width: 36, height: 36, borderLeft: `1px solid ${f.color}`, borderBottom: `1px solid ${f.color}`, opacity: 0.38 }} />
                        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, letterSpacing: 3, color: f.color, marginBottom: 18, opacity: 0.85 }}>◉&nbsp;{f.tag}</div>
                        <div style={{ fontSize: 26, marginBottom: 14 }}>{f.icon}</div>
                        <h3 style={{ fontFamily: "'Orbitron'", fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10, letterSpacing: 0.8 }}>{f.title}</h3>
                        <p style={{ fontSize: 14.5, color: T.textMid, lineHeight: 1.68 }}>{f.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

/* ─── AI CHATBOT ─────────────────────────────────────────────── */
const AISection = () => {
    const [msgs, setMsgs] = useState([
        { role: "ai", text: "FORMO AI online. How can I optimize your production today?" },
    ]);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const msgEndRef = useRef(null);
    const replyIdx = useRef(0);

    const REPLIES = [
        "Analyzing your current lot allocation... Recommend consolidating Lines 3 & 5 to reduce changeover by 18%.",
        "Raw material for PNL-2840 series: 420 kg aluminum, 36 m² panel sheet. BOM generated.",
        "Barcode scan #FR-2291-A → Production Stage 3, Operator: Ravi K., 14:32 today.",
        "MIS report Q1: Material utilization at 96.4%. Recommend reviewing SEC offcuts.",
        "Nesting optimization complete. Waste reduced from 12.3% → 6.8% for this batch.",
        "Scheduling analysis: Line 2 is 12% under capacity. Reassigning 3 lots from Line 4.",
    ];

    const send = () => {
        if (!input.trim()) return;
        setMsgs(m => [...m, { role: "user", text: input }]);
        setInput("");
        setTyping(true);
        setTimeout(() => {
            setMsgs(m => [...m, { role: "ai", text: REPLIES[replyIdx.current % REPLIES.length] }]);
            replyIdx.current++;
            setTyping(false);
        }, 1400);
    };

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

    return (
        <section style={{ padding: "120px 40px", background: T.surfaceHigh }}>
            <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="grid-2">
                <motion.div initial={{ opacity: 0, x: -44 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}>
                    <span className="tag" style={{ marginBottom: 24, display: "inline-block" }}>AI Intelligence</span>
                    <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(24px, 4vw, 50px)", fontWeight: 700, lineHeight: 1.08, color: T.text, marginBottom: 24 }}>
                        Your Smart<br /><span style={{ color: T.gold }}>Production Copilot</span>
                    </h2>
                    <p style={{ fontSize: 18, color: T.textMid, lineHeight: 1.72, marginBottom: 36 }}>
                        FORMO AI understands your production floor. Ask in plain language — get instant BOM calculations, production insights, and barcode lookups.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {["Natural language queries", "Voice command support", "Real-time production insights", "Barcode history lookup", "Predictive scheduling"].map((f, i) => (
                            <motion.div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}
                                initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                                <div style={{ width: 5, height: 5, background: T.gold, flexShrink: 0 }} />
                                <span style={{ fontSize: 16, color: T.textMid }}>{f}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 44 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}
                    style={{ border: `1px solid var(--border)`, background: "var(--surface)", backdropFilter: "blur(18px)", boxShadow: "var(--shadow-lg)", borderRadius: 12, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--primary-glow)" }}>
                        <motion.div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} animate={{ boxShadow: ["0 0 0px #22c55e", "0 0 10px #22c55e", "0 0 0px #22c55e"] }} transition={{ repeat: Infinity, duration: 2 }} />
                        <span style={{ fontFamily: "'Orbitron'", fontSize: 11, color: T.primary, letterSpacing: 2 }}>FORMO AI — ONLINE</span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                            {["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.75 }} />)}
                        </div>
                    </div>
                    {/* Messages */}
                    <div style={{ height: 290, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                        {msgs.map((m, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                <div style={{
                                    maxWidth: "80%", padding: "11px 15px", fontSize: 13.5, color: "var(--text)", lineHeight: 1.52, fontFamily: "var(--font-sans)",
                                    background: m.role === "user" ? "var(--primary-glow)" : "var(--glass)",
                                    border: m.role === "user" ? "1px solid var(--primary)" : "1px solid var(--border)",
                                    borderRadius: 8
                                }}>
                                    {m.role === "ai" && <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: T.gold, letterSpacing: 2, marginBottom: 5 }}>◉ FORMO AI</div>}
                                    {m.text}
                                </div>
                            </motion.div>
                        ))}
                        {typing && (
                            <div style={{ display: "flex", gap: 4, padding: "10px 14px" }}>
                                {[0, 1, 2].map(i => (
                                    <motion.div key={i} style={{ width: 5, height: 5, background: T.gold, borderRadius: "50%" }}
                                        animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.75, delay: i * 0.14 }} />
                                ))}
                            </div>
                        )}
                        <div ref={msgEndRef} />
                    </div>
                    {/* Input */}
                    <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 10, background: "var(--surface-high)" }}>
                        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                            placeholder="Ask FORMO AI anything..."
                            style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", padding: "9px 14px", color: "var(--text)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none", borderRadius: 4 }} />
                        <button className="btn-primary" onClick={send} style={{ padding: "9px 18px", fontSize: 9 }}><span>SEND</span></button>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

/* ─── ANALYTICS ──────────────────────────────────────────────── */
const Analytics = ({ stats }) => {
    const bars = [74, 88, 62, 91, 97, 70, 83, 95, 68, 86, 93, 78];
    const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    const [hovBar, setHovBar] = useState(null);

    return (
        <section id="analytics" style={{ padding: "120px 40px", background: T.bg }} className="grid-bg">
            <div style={{ maxWidth: 1320, margin: "0 auto" }}>
                <motion.div style={{ textAlign: "center", marginBottom: 80 }}
                    initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                    <span className="tag" style={{ marginBottom: 20, display: "inline-block" }}>Production Intelligence</span>
                    <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(28px,5vw,54px)", fontWeight: 700, lineHeight: 1.1, color: T.text, marginTop: 20 }}>
                        Complete <span style={{ color: T.primary }}>Analysis Dashboard</span>
                    </h2>
                </motion.div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 2 }} className="grid-2">
                    {/* Chart */}
                    <motion.div className="feat-card" initial={{ opacity: 0, x: -36 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                        <div style={{ fontFamily: "'Orbitron'", fontSize: 11, color: T.primary, letterSpacing: 2, marginBottom: 32 }}>◉ MATERIAL UTILIZATION — 2024</div>
                        {/* Legend */}
                        <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
                            {[["Normal", T.primary], ["Peak", T.gold]].map(([l, c]) => (
                                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 10, height: 3, background: c }} />
                                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: T.textMuted }}>{l}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 168, marginBottom: 10 }}>
                            {bars.map((h, i) => {
                                const isPeak = i === 4 || i === 7 || i === 10;
                                return (
                                    <motion.div key={i}
                                        style={{
                                            flex: 1, borderRadius: "2px 2px 0 0", cursor: "pointer", position: "relative",
                                            background: isPeak
                                                ? `linear-gradient(to top, ${T.gold}, rgba(184,106,0,0.22))`
                                                : `linear-gradient(to top, ${T.primary}, rgba(0,85,187,0.18))`,
                                            filter: hovBar === i ? "brightness(1.15)" : "brightness(1)",
                                            transition: "filter 0.2s",
                                        }}
                                        initial={{ height: 0 }}
                                        whileInView={{ height: `${h}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.9, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                                        onMouseEnter={() => setHovBar(i)}
                                        onMouseLeave={() => setHovBar(null)}
                                    >
                                        {hovBar === i && (
                                            <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", fontFamily: "'JetBrains Mono'", fontSize: 9, color: isPeak ? T.gold : T.primary, whiteSpace: "nowrap" }}>{h}%</div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", gap: 7 }}>
                            {months.map((m, i) => (
                                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono'" }}>{m}</div>
                            ))}
                        </div>
                    </motion.div>

                    {/* KPI cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {[
                            { label: "Avg Utilization", val: stats.utilization, color: T.primary, change: "+2.1%" },
                            { label: "Active Lots", val: stats.activeLots, color: T.gold, change: "+12" },
                            { label: "Items Tracked", val: stats.itemsTracked, color: T.primary, change: "Live" },
                            { label: "BOM Accuracy", val: stats.bomAccuracy, color: T.gold, change: "±0.02%" },
                        ].map((k, i) => (
                            <motion.div key={i} className="feat-card"
                                initial={{ opacity: 0, x: 36 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                style={{ padding: "18px 22px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5, fontFamily: "'JetBrains Mono'" }}>{k.label}</div>
                                        <div style={{ fontFamily: "'Orbitron'", fontSize: 22, fontWeight: 700, color: k.color }}>{k.val}</div>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#15803d", fontFamily: "'JetBrains Mono'", background: "rgba(21,128,61,0.08)", padding: "4px 8px", border: "1px solid rgba(21,128,61,0.2)" }}>{k.change}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

/* ─── BARCODE SECTION ────────────────────────────────────────── */
const BarcodeSection = () => {
    const [scanDone, setScanDone] = useState(false);
    useEffect(() => { const t = setTimeout(() => setScanDone(true), 3000); return () => clearTimeout(t); }, []);

    return (
        <section style={{ padding: "120px 40px", background: T.surfaceHigh }}>
            <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="grid-2">

                {/* Visual */}
                <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                    style={{ border: "1px solid var(--border)", padding: 40, textAlign: "center", background: "var(--surface)", backdropFilter: "blur(20px)", boxShadow: "var(--shadow-lg)", position: "relative", overflow: "hidden", borderRadius: 12 }}>
                    {/* Scan line */}
                    {!scanDone && (
                        <motion.div
                            style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.primary}, transparent)`, boxShadow: `0 0 20px ${T.primaryGlow}` }}
                            animate={{ top: ["8%", "92%", "8%"] }}
                            transition={{ duration: 2.4, repeat: 1, ease: "linear" }}
                        />
                    )}
                    {/* Corner brackets */}
                    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, c], i) => (
                        <div key={i} style={{
                            position: "absolute", width: 20, height: 20,
                            top: r ? "auto" : 12, bottom: r ? 12 : "auto",
                            left: c ? "auto" : 12, right: c ? 12 : "auto",
                            borderTop: r ? "none" : `2px solid ${T.primary}`,
                            borderBottom: r ? `2px solid ${T.primary}` : "none",
                            borderLeft: c ? "none" : `2px solid ${T.primary}`,
                            borderRight: c ? `2px solid ${T.primary}` : "none",
                        }} />
                    ))}

                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: T.primary, letterSpacing: 3, marginBottom: 22 }}>
                        {scanDone ? "◉ SCAN COMPLETE" : "◉ SCANNING ▓▓▓▓▓░░░░"}
                    </div>

                    {/* Barcode bars */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 2.5, marginBottom: 18, alignItems: "flex-end" }}>
                        {Array.from({ length: 36 }, (_, i) => (
                            <div key={i} style={{
                                width: i % 5 === 0 ? 5 : i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 4,
                                height: i % 7 === 0 ? 88 : 72,
                                background: T.text, opacity: 0.82,
                            }} />
                        ))}
                    </div>

                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: T.textMuted, letterSpacing: 4, marginBottom: 22 }}>
                        FR-2291-A-PNL-0042
                    </div>

                    <AnimatePresence>
                        {scanDone && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ padding: "14px 20px", border: "1px solid var(--border)", background: "var(--bg-surface)", textAlign: "left" }}
                            >
                                {[["ITEM", "PNL-2840 Panel"], ["LOT", "LOT-2024-Q4-048"], ["STAGE", "Production Line 3"], ["OPERATOR", "Ravi K."], ["STATUS", "✓ Approved"]].map(([k, v]) => (
                                    <div key={k} style={{ display: "flex", gap: 16, marginBottom: 7 }}>
                                        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono'", minWidth: 66, letterSpacing: 1 }}>{k}</span>
                                        <span style={{ fontSize: 13.5, color: T.text }}>{v}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 44 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}>
                    <span className="tag" style={{ marginBottom: 24, display: "inline-block" }}>Item Traceability</span>
                    <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(24px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.08, color: T.text, marginBottom: 24 }}>
                        Scan Once.<br /><span style={{ color: T.primary }}>Know Everything.</span>
                    </h2>
                    <p style={{ fontSize: 18, color: T.textMid, lineHeight: 1.72, marginBottom: 36 }}>
                        Every aluminum formwork item carries its full history in a barcode — from IPO creation to planning, user interactions, and production status.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {["IPO & planning stage history", "User assignment tracking", "Production line traceability", "Real-time location status"].map((f, i) => (
                            <motion.div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}
                                initial={{ opacity: 0, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                                <div style={{ width: 5, height: 5, background: T.primary, flexShrink: 0 }} />
                                <span style={{ fontSize: 16, color: T.textMid }}>{f}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

/* ─── WORKFLOW STEPS ─────────────────────────────────────────── */
const Workflow = () => {
    const steps = [
        { n: "01", title: "Import CAD Plans", desc: "Upload DXF, DWG, or PDF formwork drawings. FORMO auto-parses components." },
        { n: "02", title: "Run Nesting Engine", desc: "2D optimization engine minimizes sheet waste. Preview and fine-tune layouts." },
        { n: "03", title: "Generate BOM", desc: "One-click bill of materials with quantity, dimensions, and raw material totals." },
        { n: "04", title: "Assign to Production", desc: "Dispatch lot to production lines. Assign operators. Set priority and deadlines." },
        { n: "05", title: "Barcode & Track", desc: "Print barcodes. Scan at each stage. Real-time floor visibility from any device." },
        { n: "06", title: "Analyze & Report", desc: "Auto-generated MIS, lot, and production reports. Export to PDF, Excel, or API." },
    ];
    return (
        <section id="aboutus" style={{ padding: "120px 40px", background: T.bg }}>
            <div style={{ maxWidth: 1320, margin: "0 auto" }}>
                <motion.div style={{ textAlign: "center", marginBottom: 80 }}
                    initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                    <span className="tag" style={{ marginBottom: 20, display: "inline-block" }}>How It Works</span>
                    <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(28px,5vw,54px)", fontWeight: 700, color: T.text, marginTop: 20 }}>
                        Six Steps to <span style={{ color: T.gold }}>Zero Waste</span>
                    </h2>
                </motion.div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }} className="grid-2">
                    {steps.map((s, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.08 }}
                            className="feat-card" style={{ paddingTop: 36 }}>
                            <div style={{ fontFamily: "'Orbitron'", fontSize: 36, fontWeight: 900, color: "var(--primary-glow)", marginBottom: 12, lineHeight: 1 }}>{s.n}</div>
                            <h3 style={{ fontFamily: "'Orbitron'", fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 10, letterSpacing: 0.8 }}>{s.title}</h3>
                            <p style={{ fontSize: 14.5, color: T.textMid, lineHeight: 1.68 }}>{s.desc}</p>
                            {i < steps.length - 1 && (
                                <div style={{ position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)", width: 1, height: 2, background: T.primary, opacity: 0.3 }} />
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* ─── CTA ────────────────────────────────────────────────────── */
const CTA = () => (
    <section id="contactus" style={{ padding: "130px 40px", background: T.surface, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Glow orbs */}
        <div style={{ position: "absolute", top: "50%", left: "30%", transform: "translate(-50%,-50%)", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${T.primaryGlow} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: "70%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${T.goldGlow} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <motion.div style={{ position: "relative", zIndex: 1 }}
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}>
            <span className="tag" style={{ marginBottom: 36, display: "inline-block" }}>Start Today</span>
            <h2 style={{ fontFamily: "'Orbitron'", fontSize: "clamp(34px,6.5vw,78px)", fontWeight: 900, lineHeight: 1.02, color: T.text, marginBottom: 28 }}>
                Build Smarter.<br /><span style={{ color: T.primary }}>Waste Less.</span><br />Deliver More.
            </h2>
            <p style={{ fontSize: "clamp(17px,1.9vw,21px)", color: T.textMid, marginBottom: 52, maxWidth: 480, margin: "0 auto 52px" }}>
                Join production teams that plan, track, and optimize aluminum formwork with FORMO.
            </p>
            <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-primary" style={{ padding: "18px 52px" }}><span>Request a Demo</span></button>
                <button className="btn-gold" style={{ padding: "18px 52px" }}><span>Contact Sales</span></button>
            </div>
        </motion.div>
    </section>
);

/* ─── FOOTER ─────────────────────────────────────────────────── */
const Footer = () => (
    <footer style={{ padding: "36px 40px", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>
                FORM<span style={{ color: "var(--primary)" }}>O</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: 2.5 }}>
                (C) 2024 FORMO PLATFORM | ALL RIGHTS RESERVED
            </div>
            <div style={{ display: "flex", gap: 24 }}>
                {["Privacy", "Terms", "Contact"].map(l => (
                    <a key={l} href="#" style={{ fontFamily: "var(--font-heading)", fontSize: 12, letterSpacing: 2, color: "var(--text-muted)", textDecoration: "none" }}>{l}</a>
                ))}
            </div>
        </div>
    </footer>
);

/* ─── APP ────────────────────────────────────────────────────── */
export default function FormoHomepage() {
    const { scrollYProgress } = useScroll();
    const { theme } = useTheme();
    const { user, profile } = useAuth();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

    const [realStats, setRealStats] = useState({
        itemsTracked: "12,400+",
        bomAccuracy: "99.8%",
        activeLots: "148",
        utilization: "94.2%",
        utilizationHistory: [74, 88, 62, 91, 97, 70, 83, 95, 68, 86, 93, 78]
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || !profile?.company_id) return;
            try {
                const [ipoRes, utilRes] = await Promise.all([
                    supabase.from('v_ipo_summary').select('barcode_count, total_qty_processed').eq('company_id', profile.company_id),
                    supabase.from('v_rm_utilization').select('utilization_pct').eq('company_id', profile.company_id)
                ]);

                if (ipoRes.data || utilRes.data) {
                    const totalTracked = ipoRes.data?.reduce((acc, curr) => acc + (curr.barcode_count || 0), 0) || 0;
                    const avgUtil = utilRes.data?.length 
                        ? (utilRes.data.reduce((acc, curr) => acc + parseFloat(curr.utilization_pct), 0) / utilRes.data.length).toFixed(1)
                        : "0.0";

                    setRealStats(prev => ({
                        ...prev,
                        itemsTracked: totalTracked > 0 ? totalTracked.toLocaleString() + "+" : prev.itemsTracked,
                        activeLots: ipoRes.data?.length.toString() || prev.activeLots,
                        utilization: avgUtil + "%"
                    }));
                }
            } catch (err) {
                console.error("Error fetching home stats:", err);
            }
        };
        fetchStats();
    }, [user]);

    return (
        <>
            <GlobalStyle />
            <Cursor />

            {/* Scroll progress bar */}
            <motion.div style={{
                position: "fixed", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${T.primary}, ${T.gold})`,
                scaleX, transformOrigin: "0%", zIndex: 200,
            }} />

            {/* THREE.JS scene (full-screen fixed background) */}
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
                <BuildingScene scrollY={scrollYProgress} theme={theme} />
            </div>

            <main style={{ position: "relative", zIndex: 1 }}>
                <Hero theme={theme} stats={realStats} />
                <StatsBand />
                <Features />
                <AISection />
                <Analytics stats={realStats} />
                <BarcodeSection />
                <Workflow />
                <CTA />
                <Footer />
            </main>
        </>
    );
}
