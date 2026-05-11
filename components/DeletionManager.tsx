
"use client";

import React, { useState } from 'react';
import { useAuth } from "@/firebase/AuthContext";
import { requestAccountDeletion } from '../lib/deletion';

export default function DeletionManager() {
    const { user } = useAuth();
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleRequestDeletion = async () => {
        if (!user || confirmation !== 'delete my account') return;
        setIsRequesting(true);
        setError(null);
        try {
            await requestAccountDeletion();
            // Ideally, the user should be logged out and redirected
            // after a successful deletion request.
            alert("Your account deletion request has been submitted. You will be logged out.");
            // Here you would typically call your sign-out function
        } catch (error) {
            console.error("Failed to request account deletion:", error);
            setError("There was an error submitting your request. Please try again.");
        }
        setIsRequesting(false);
    };

    return (
        <div className="not-prose">
            <p className="text-gray-600 dark:text-gray-400">Request the permanent deletion of your account and all associated data. This action is irreversible.</p>
            
            {!showConfirmation ? (
                <button 
                    onClick={() => setShowConfirmation(true)}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                    Request Account Deletion
                </button>
            ) : (
                <div className="mt-4 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p className="font-medium">Are you sure?</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">To confirm, please type "delete my account" in the box below.</p>
                    <input 
                        type="text" 
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        className="w-full p-2 mt-2 border rounded-md"
                    />
                    <button 
                        onClick={handleRequestDeletion}
                        disabled={isRequesting || confirmation !== 'delete my account'}
                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isRequesting ? 'Requesting...' : 'Confirm Deletion'}
                    </button>
                </div>
            )}

            {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
    );
}
