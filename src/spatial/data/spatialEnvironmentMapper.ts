/*
URAI - Spatial Environment Mapper
Privacy-Safe Derived State Wiring Architect

This module is responsible for mapping safe, derived numerical signals 
into the qualitative environmental state for the Spatial Scene.
It ensures that no raw or sensitive user data is processed client-side.

NON-NEGOTIABLE RULES:
- This mapper must only consume derived_signals, not raw user data.
- The output must conform to the SpatialEnvironmentState interface.
- Logic must remain stateless and deterministic.
*/

// The core set of derived signals this mapper is allowed to consume.
// These are pre-processed, privacy-safe aggregations.
export interface SafeDerivedSignals {
    avg_stress_level_7d: number;      // e.g., 0.0 to 1.0
    stress_trend_3d: number;         // e.g., -1.0 (decreasing) to 1.0 (increasing)
    avg_clarity_score_7d: number;    // e.g., 0.0 to 1.0
    recovery_events_24h: number;     // e.g., count of completed recovery goals
    social_connection_level: number; // e.g., 0.0 to 1.0, derived from safe social interactions
    anomaly_alert_level: number;     // 0 (none), 1 (low), 2 (high)
}

// Defines the final state of the visual environment.
// This is the contract between the data layer and the presentation layer.
export interface SpatialEnvironmentState {
    skyMood: 'calm' | 'unsettled' | 'stormy' | 'serene';
    forecastTrend: 'improving' | 'stable' | 'worsening';
    stressDensity: number; // 0.0 to 1.0, visual density of stress-related effects
    clarityLevel: number;  // 0.0 to 1.0, e.g., atmospheric haze or water clarity
    recoverySignal: boolean; // true if a recent recovery event should trigger a visual cue
    socialWeather: 'isolated' | 'connected';
}

/**
 * Maps a set of safe derived signals into a concrete SpatialEnvironmentState.
 * @param signals - The pre-aggregated, privacy-safe data signals.
 * @returns A SpatialEnvironmentState object ready for consumption by the UI.
 */
export const mapDerivedSignalsToEnvironment = (signals: SafeDerivedSignals): SpatialEnvironmentState => {

    // 1. Map Sky Mood from stress and anomaly levels
    let skyMood: SpatialEnvironmentState['skyMood'] = 'calm';
    if (signals.anomaly_alert_level > 0) {
        skyMood = 'stormy';
    } else if (signals.avg_stress_level_7d > 0.65) {
        skyMood = 'unsettled';
    } else if (signals.avg_stress_level_7d < 0.2 && signals.avg_clarity_score_7d > 0.7) {
        skyMood = 'serene';
    }

    // 2. Map Forecast Trend from stress trend data
    let forecastTrend: SpatialEnvironmentState['forecastTrend'] = 'stable';
    if (signals.stress_trend_3d < -0.3) {
        forecastTrend = 'improving';
    } else if (signals.stress_trend_3d > 0.3) {
        forecastTrend = 'worsening';
    }

    // 3. Map Social Weather
    const socialWeather: SpatialEnvironmentState['socialWeather'] = signals.social_connection_level > 0.5 ? 'connected' : 'isolated';

    // 4. Directly map other signals
    const stressDensity = Math.min(signals.avg_stress_level_7d * 1.2, 1.0); // Amplify density slightly
    const clarityLevel = signals.avg_clarity_score_7d;
    const recoverySignal = signals.recovery_events_24h > 0;

    return {
        skyMood,
        forecastTrend,
        stressDensity,
        clarityLevel,
        recoverySignal,
        socialWeather,
    };
};
