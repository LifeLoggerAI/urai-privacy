/*
URAI - Privacy Spatial Adapter
Privacy-Safe Derived State Wiring Architect

This is the single, authoritative access point for client-side spatial components
to request privacy-safe data. It orchestrates calls to backend runtimes
and ensures no sensitive data or direct DB queries occur on the client.

NON-NEGOTIABLE RULES:
- All functions must return Promises resolving to structured, safe data.
- No direct use of Firestore or other database SDKs.
- This adapter is the ONLY bridge between the scene and the data layer.
*/

import { mapDerivedSignalsToEnvironment, SpatialEnvironmentState, SafeDerivedSignals } from './spatialEnvironmentMapper';

// Mock/Placeholder for a backend API calling library (e.g., Axios, Fetch, or Firebase Functions SDK)
// In a real project, this would be configured to hit the correct endpoints.
const backendApi = {
    post: (endpoint, body) => {
        console.log(`Calling backend endpoint: ${endpoint} with body:`, body);
        // This is a placeholder. A real implementation would return a Promise
        // that resolves with the result of an actual network request.
        // We'''ll return mock data that matches the expected structure.
        if (endpoint === 'getDerivedSignals') {
            const mockSignals: SafeDerivedSignals = {
                avg_stress_level_7d: Math.random(),
                stress_trend_3d: Math.random() * 2 - 1,
                avg_clarity_score_7d: Math.random(),
                recovery_events_24h: Math.floor(Math.random() * 3),
                social_connection_level: Math.random(),
                anomaly_alert_level: Math.floor(Math.random() * 3),
            };
            return Promise.resolve({ data: { result: mockSignals } });
        }
        if (endpoint === 'getReplayNarratorContext') {
            const mockContext = {
                title: 'A Moment of Reflection',
                emotionalTone: 'Calm',
                sourceHighlights: ['journal_entry_123', 'mood_log_456'],
            };
            return Promise.resolve({ data: { result: mockContext } });
        }
        if (endpoint === 'fetchLifeMapData') {
             const mockLifeMapData = [
                { id: 'star1', focus_score: 0.8, type: 'memory' },
                { id: 'star2', focus_score: 0.5, type: 'event' },
            ];
            return Promise.resolve({ data: { result: mockLifeMapData } });
        }
        if (endpoint === 'getStarDetails') {
            const mockStarDetails = {
                id: 'star1',
                title: 'Beach trip',
                summary: 'A wonderful day at the beach.',
                type: 'memory',
                focus_score: 0.8,
            };
            return Promise.resolve({ data: { result: mockStarDetails } });
        }
        return Promise.reject(new Error(`Unknown endpoint: ${endpoint}`));
    }
};


/**
 * Fetches the current, privacy-safe environment state for a user.
 * It gets derived signals from the backend and maps them to a visual state.
 * @param userId - The ID of the user.
 * @returns A Promise that resolves to the SpatialEnvironmentState.
 */
export const getEnvironmentState = async (userId: string): Promise<SpatialEnvironmentState> => {
    console.log(`Adapter: Requesting environment state for user ${userId}`);
    // 1. Call the backend runtime to get the safe, derived signals.
    const response = await backendApi.post('getDerivedSignals', { userId });
    const signals: SafeDerivedSignals = response.data.result;

    // 2. Use the local mapper to transform signals into the environment state.
    // This keeps the client stateless and free of complex logic.
    const environmentState = mapDerivedSignalsToEnvironment(signals);

    console.log("Adapter: Mapped signals to state:", environmentState);
    return environmentState;
};

/**
 * Fetches the specific narrative context for replaying a memory (a "star").
 * This call is brokered through the adapter to ensure a consistent, safe interface.
 * @param userId - The ID of the user.
 * @param starId - The ID of the star/memory to be replayed.
 * @returns A Promise that resolves to the narrator'''s context for the replay.
 */
export const getReplayNarratorContext = async (userId: string, starId: string): Promise<any> => {
    console.log(`Adapter: Requesting replay context for star ${starId}`);
    const response = await backendApi.post('getReplayNarratorContext', { userId, starId });
    return response.data.result;
};

/**
 * Fetches the high-level data for the LifeMap starfield.
 * This function is added proactively to be used when patching LifeMapStarfield.tsx.
 */
export const fetchLifeMapData = (userId: string): Promise<any> => {
    console.log(`Adapter: Fetching LifeMap data for user ${userId}`);
    return backendApi.post('fetchLifeMapData', { userId });
};

/**
 * Gets the detailed, but still safe, information for a single focused star.
 * This function is added proactively to be used when patching FocusSubject.tsx.
 */
export const getStarDetails = (userId: string, starId: string): Promise<any> => {
    console.log(`Adapter: Fetching details for star ${starId}`);
    return backendApi.post('getStarDetails', { userId, starId });
};
