
import React, { useState, useEffect } from 'react';
import { getReplayNarratorContext, getReplayVoiceScript } from '../../lib/narratorReplayRuntime';

/**
 * Manages and displays the immersive replay of a memory, driven by the Narrator.
 * This component now consumes the privacy-safe narrator runtime for its content.
 */
export const ReplayScene = ({ userId, starId, onClose }) => {
    const [narratorContext, setNarratorContext] = useState(null);
    const [voiceScript, setVoiceScript] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userId && starId) {
            setIsLoading(true);
            console.log(`ReplayScene: Initializing for star ${starId}...`);

            // Fetch the context and script from the new runtime.
            Promise.all([
                getReplayNarratorContext(userId, starId),
                getReplayVoiceScript(userId, starId)
            ])
            .then(([contextResponse, scriptResponse]) => {
                // @ts-ignore
                setNarratorContext(contextResponse.data.result);
                // @ts-ignore
                setVoiceScript(scriptResponse.data.result);
                setIsLoading(false);
            })
            .catch(error => {
                console.error(`Failed to initialize replay scene for ${starId}:`, error);
                setIsLoading(false);
            });
        }
    }, [userId, starId]);

    if (isLoading) {
        return <div className="replay-scene-overlay"><div>Loading Replay...</div></div>;
    }

    if (!narratorContext || !voiceScript) {
        return (
            <div className="replay-scene-overlay">
                <div>
                    <p>The narrator could not construct a replay for this memory.</p>
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    // The actual rendering of the replay would be more complex, involving audio playback,
    // timed animations, and visual effects based on the narrator context.
    return (
        <div className="replay-scene-overlay" onClick={onClose}>
            <div className="replay-content">
                <h1>{narratorContext.title}</h1>
                <p className="narrator-voice-line">{voiceScript.line}</p>
                <div className="narrator-subtext">
                    <p>Mood: {narratorContext.emotionalTone}</p>
                    <p>Source Events: {narratorContext.sourceHighlights.join(', ')}</p>
                </div>
                <button onClick={onClose} style={{ marginTop: '20px' }}>End Replay</button>
            </div>
        </div>
    );
};
