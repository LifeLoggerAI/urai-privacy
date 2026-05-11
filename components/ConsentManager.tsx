
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/firebase/AuthContext";
import { getConsentProfile, updateConsent, acknowledgePolicy } from '../lib/consent';

const consentCategoriesMetadata = {
    'audio/transcription': { name: 'Audio Transcription', description: 'Allows transcription of audio data to text.' },
    'GPS/location': { name: 'GPS Location', description: 'Permits use of your GPS data for location-based services.' },
    'social graph/relationship data': { name: 'Social Graph', description: 'Enables features based on your social connections.' },
    'mood/emotional data': { name: 'Emotional Data Analysis', description: 'Used to analyze mood and emotional state for personalized experiences.' },
    'health/wellness signals': { name: 'Health & Wellness Tracking', description: 'Tracks health signals to provide wellness insights.' },
    'anonymized data licensing': { name: 'Anonymized Data Licensing', description: 'Allows us to license your anonymized data to third parties.' },
    'product analytics': { name: 'Product Analytics', description: 'Helps us improve our product through usage analytics.' },
    'AI insight generation': { name: 'AI Insight Generation', description: 'Generates personalized insights using AI models.' },
};


const ConsentManager = () => {
    const { user } = useAuth();
    const [consentProfile, setConsentProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (user) {
                try {
                    const profile = await getConsentProfile(user.uid);
                    setConsentProfile(profile);
                } catch (e) {
                    console.error(e);
                    setError('Failed to fetch consent profile.');
                }
            }
            setLoading(false);
        };

        fetchProfile();
    }, [user]);

    const handleConsentChange = async (category: string, enabled: boolean) => {
        if (!user) return;
        setSaving(category);
        setError(null);
        try {
            const updatedCategories = await updateConsent(user.uid, category, enabled);
            setConsentProfile((prev) => ({ ...prev, categories: updatedCategories }));
        } catch (e) {
            console.error(e);
            setError('Failed to update consent. Please try again.');
            // Revert optimistic UI update on failure
            setConsentProfile((prev) => ({ ...prev }));
        } finally {
            setSaving(null);
        }
    };

    const handlePolicyAcknowledgement = async () => {
        if (!user) return;
        try {
            await acknowledgePolicy(user.uid, '2024-06-01');
            setConsentProfile((prev) => ({ ...prev, policyAcknowledgement: { version: '2024-06-01' } }));
        } catch (e) {
            console.error(e);
            setError('Failed to acknowledge policy.');
        }
    };

    if (loading) return <p>Loading consent settings...</p>;
    if (error) return <p className="text-red-500">{error}</p>;
    if (!consentProfile) return <p>No consent profile found.</p>;

    const { categories, policyAcknowledgement } = consentProfile;

    return (
        <div className="not-prose space-y-6">
            {!policyAcknowledgement && (
                 <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-medium">Policy Update</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Our privacy policy has been updated. Please review and acknowledge it to continue.</p>
                    </div>
                    <button 
                        onClick={handlePolicyAcknowledgement}
                        className="mt-2 sm:mt-0 sm:ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-shrink-0">
                        Acknowledge
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(consentCategoriesMetadata).map(([category, metadata]) => (
                    <div key={category} className="flex items-start justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-grow">
                            <span className="font-medium">{metadata.name}</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{metadata.description}</p>
                             {categories[category]?.revokedAt && (
                                <p className="text-xs text-red-500 mt-1">Revoked on: {new Date(categories[category].revokedAt.seconds * 1000).toLocaleDateString()}</p>
                            )}
                        </div>
                        <div className="flex items-center ml-4 flex-shrink-0">
                            {saving === category && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-white"></div>}
                            <label className="relative inline-flex items-center cursor-pointer ml-3">
                                <input 
                                    type="checkbox" 
                                    checked={categories[category]?.enabled || false}
                                    onChange={(e) => handleConsentChange(category, e.target.checked)}
                                    className="sr-only peer" 
                                    disabled={saving !== null}
                                />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConsentManager;
