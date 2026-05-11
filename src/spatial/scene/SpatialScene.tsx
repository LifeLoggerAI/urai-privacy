/*
URAI - Spatial Scene (Patched)
Runtime Entry Point

This is the main container for the entire spatial experience. It has been
patched to remove all direct data queries and instead relies on the
privacySpatialAdapter to fetch the environment state.

Original Behavior: Directly queried Firestore for user'''s emotional state.
Patched Behavior: Calls getEnvironmentState(userId) via the adapter.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';

// The single, authoritative adapter for all spatial data
import { getEnvironmentState } from '../data/privacySpatialAdapter';
import { SpatialEnvironmentState } from '../data/spatialEnvironmentMapper';

// Child components
import { LifeMapStarfield } from '../components/LifeMapStarfield';
import { FocusSubject } from '../components/FocusSubject';

interface SpatialSceneProps {
    userId: string;
}

// This component is now responsible for setting the scene'''s ambient mood.
const EnvironmentController = ({ environmentState }: { environmentState: SpatialEnvironmentState }) => {
    const skyProps = useMemo(() => {
        switch (environmentState.skyMood) {
            case 'stormy':
                return { turbidity: 8, rayleigh: 0.1, inclination: 0.6 };
            case 'unsettled':
                return { turbidity: 4, rayleigh: 0.5, inclination: 0.4 };
            case 'serene':
                return { turbidity: 0.1, rayleigh: 1, inclination: 0.2 };
            case 'calm':
            default:
                return { turbidity: 1, rayleigh: 2, inclination: 0.0 };
        }
    }, [environmentState.skyMood]);

    return (
        <>
            <Sky {...skyProps} />
            <Stars count={5000} factor={environmentState.clarityLevel * 4} />
            <fog attach="fog" args={['#030508', 5, 25 * environmentState.clarityLevel]} />
        </>
    );
};

export const SpatialScene: React.FC<SpatialSceneProps> = ({ userId }) => {
    const [environmentState, setEnvironmentState] = useState<SpatialEnvironmentState | null>(null);
    const [activeStarId, setActiveStarId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // On component mount, fetch the environment state using the adapter.
        // This is the ONLY place data fetching is initiated for the environment.
        getEnvironmentState(userId)
            .then(setEnvironmentState)
            .catch(err => {
                console.error("Failed to load environment state:", err);
                setError("Could not load the spatial environment.");
            });
    }, [userId]); // Refetch if the user ID ever changes.

    if (error) {
        return <div>{error}</div>;
    }

    if (!environmentState) {
        return <div>Loading Spatial Environment...</div>;
    }

    return (
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
            <ambientLight intensity={0.1} />
            <pointLight position={[10, 10, 10]} />

            {/* The EnvironmentController consumes the safe, mapped state */}
            <EnvironmentController environmentState={environmentState} />

            {/* The starfield now only deals with presentation */}
            <LifeMapStarfield userId={userId} onStarClick={setActiveStarId} />

            {/* The focus subject appears when a star is clicked */}
            {activeStarId && <FocusSubject userId={userId} starId={activeStarId} />}

        </Canvas>
    );
};
