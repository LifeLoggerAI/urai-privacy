/*
URAI - Focus Subject (Patched)
Runtime Entry Point

This component displays the detailed, but still safe, information for a single
focused star when it is selected from the LifeMap.

Original Behavior: Directly queried a specific Firestore document from the `stars` collection.
Patched Behavior: Calls `getStarDetails(userId, starId)` via the adapter.
*/

import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';

// The single, authoritative adapter for all spatial data
import { getStarDetails } from '../data/privacySpatialAdapter';

interface FocusSubjectProps {
    userId: string;
    starId: string;
}

export const FocusSubject: React.FC<FocusSubjectProps> = ({ userId, starId }) => {
    const [details, setDetails] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // When the starId changes, fetch the specific details for that star.
        if (starId) {
            setDetails(null); // Clear previous state
            getStarDetails(userId, starId)
                .then(response => {
                    setDetails(response.data.result);
                })
                .catch(err => {
                    console.error(`Failed to load details for star ${starId}:`, err);
                    setError("Could not load star details.");
                });
        }
    }, [userId, starId]);

    if (error) {
        return <Html center><div style={{ color: 'red' }}>{error}</div></Html>;
    }

    if (!details) {
        return <Html center><div>Loading details...</div></Html>;
    }

    // The component renders a simple HTML overlay with the fetched, safe data.
    // The presentation is kept clean and separate from the data fetching.
    return (
        <group position={[0, 0, 5]}> {/* Position the view in front of the camera */}
            <Html center>
                <div style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '10px',
                    width: '300px', 
                    textAlign: 'center'
                }}>
                    <h2>{details.title}</h2>
                    <p>Type: {details.type}</p>
                    <p>Focus Score: {details.focus_score}</p>
                    <p>{details.summary}</p>
                </div>
            </Html>
        </group>
    );
};
