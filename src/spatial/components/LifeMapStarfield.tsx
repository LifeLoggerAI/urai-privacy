/*
URAI - LifeMap Starfield (Patched)
Runtime Entry Point

This component renders the user'''s personal "starfield" of memories and events.
It has been patched to remove direct data queries and now consumes data from
the privacySpatialAdapter.

Original Behavior: Directly queried Firestore `stars` collection.
Patched Behavior: Calls `fetchLifeMapData(userId)` via the adapter.
*/

import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// The single, authoritative adapter for all spatial data
import { fetchLifeMapData } from '../data/privacySpatialAdapter';

interface StarfieldProps {
    userId: string;
    onStarClick: (starId: string) => void;
}

// A single star, representing a memory or event.
const Star = ({ position, onClick }) => {
    const mesh = useRef<THREE.Mesh>(null!);
    const [hovered, setHovered] = useState(false);
    const [clicked, setClicked] = useState(false);

    useFrame(() => {
        if (mesh.current) {
            mesh.current.scale.set(1, 1, 1).multiplyScalar(hovered ? 1.5 : 1);
        }
    });

    return (
        <mesh
            ref={mesh}
            position={position}
            onClick={(e) => { e.stopPropagation(); setClicked(true); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={() => setHovered(false)} >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={clicked ? 'red' : 'white'} />
        </mesh>
    );
};

export const LifeMapStarfield: React.FC<StarfieldProps> = ({ userId, onStarClick }) => {
    const [stars, setStars] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch the high-level star data using the adapter.
        // This returns only the data needed for visualization (e.g., position, type).
        fetchLifeMapData(userId)
            .then(response => {
                // The adapter returns a response object, we need the result.
                // In a real scenario, this data would be mapped to 3D positions.
                const starData = response.data.result.map(star => ({
                    ...star,
                    position: [Math.random() * 20 - 10, Math.random() * 10 - 5, Math.random() * 10 - 5] // Placeholder position
                }));
                setStars(starData);
            })
            .catch(err => {
                console.error("Failed to load LifeMap data:", err);
                setError("Could not load the starfield.");
            });
    }, [userId]);

    if (error) {
        return null; // Or render an error state
    }

    return (
        <group>
            {stars.map(star => (
                <Star
                    key={star.id}
                    position={star.position}
                    onClick={() => onStarClick(star.id)}
                />
            ))}
        </group>
    );
};
