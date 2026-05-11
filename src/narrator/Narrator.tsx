/*
URAI - Narrator (Patched)
Runtime Entry Point

This component is the primary entry point for the URAI Narrator.
It has been patched to remove all direct data queries and now consumes data from
the privacySpatialAdapter, which in turn calls the narratorReplayRuntime.

Original Behavior: Directly queried multiple Firestore collections to build context.
Patched Behavior: Calls `getReplayNarratorContext(userId, starId)` via the adapter.
*/

import React, { useState, useEffect } from 'react';

// The single, authoritative adapter for all spatial and narrative data
import { getReplayNarratorContext } from '../spatial/data/privacySpatialAdapter';
// The narrator runtime would be used to get the actual voice script
import { getReplayVoiceScript } from '../lib/narratorReplayRuntime'; // This is a backend module, so this is a conceptual import.

interface NarratorProps {
    userId: string;
    activeStarId: string | null;
    onReplayComplete: () => void;
}

export const Narrator: React.FC<NarratorProps> = ({ userId, activeStarId, onReplayComplete }) => {
    const [narratorContext, setNarratorContext] = useState<any>(null);
    const [voiceScript, setVoiceScript] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeStarId) {
            // Clear state when no star is active
            setNarratorContext(null);
            setVoiceScript(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        // 1. Fetch the high-level context for the narrative replay.
        getReplayNarratorContext(userId, activeStarId)
            .then(context => {
                setNarratorContext(context.data.result);

                // 2. Once context is loaded, fetch the actual voice script.
                // In a real app, this might be triggered by a user action ("Play Memory").
                // This call goes to the backend narratorReplayRuntime.
                return getReplayVoiceScript(userId, activeStarId);
            })
            .then(script => {
                setVoiceScript(script.data.result);
            })
            .catch(err => {
                console.error(`Narrator failed for star ${activeStarId}:`, err);
                setError("The narrator was unable to recall this moment.");
            })
            .finally(() => {
                setIsLoading(false);
            });

    }, [userId, activeStarId]);

    if (isLoading) {
        return <div className="narrator-status">Recalling the moment...</div>;
    }

    if (error) {
        return <div className="narrator-error">{error}</div>;
    }

    if (!narratorContext || !voiceScript) {
        return null; // The narrator is idle
    }

    // This is a simplified render. A real component would have audio players,
    // subtitles, and controls.
    return (
        <div className="narrator-ui">
            <h3>{narratorContext.title}</h3>
            <p><em>Tone: {narratorContext.emotionalTone}</em></p>
            <hr />
            <div className="narrator-script">
                <p><strong>Narrator:</strong> "{voiceScript.line}"</p>
            </div>
            <button onClick={onReplayComplete}>Finish</button>
        </div>
    );
};
