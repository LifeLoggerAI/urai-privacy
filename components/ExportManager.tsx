
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from "@/firebase/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { requestDataExport } from '../lib/export';

interface ExportRequest {
    id: string;
    status: string;
    createdAt: any;
    downloadUrl?: string;
}

export default function ExportManager() {
    const { user } = useAuth();
    const [exports, setExports] = useState<ExportRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, "export_requests"), where("userId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const exportsData: ExportRequest[] = [];
            querySnapshot.forEach((doc) => {
                exportsData.push({ id: doc.id, ...doc.data() } as ExportRequest);
            });
            setExports(exportsData.sort((a, b) => b.createdAt - a.createdAt));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setError("Failed to load export history.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleRequestExport = async () => {
        if (!user) return;
        setIsRequesting(true);
        setError(null);
        try {
            await requestDataExport();
        } catch (error) {
            console.error("Failed to request data export:", error);
            setError("There was an error requesting your data. Please try again.");
        }
        setIsRequesting(false);
    };

    return (
        <div className="not-prose">
            <p className="mb-6 text-gray-600 dark:text-gray-400">You can request an export of your personal data. This process may take a few minutes. Once complete, you will be able to download it from this page.</p>
            <button 
                onClick={handleRequestExport}
                disabled={isRequesting || exports.some(e => e.status === 'pending')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isRequesting ? 'Requesting...' : 'Request New Data Export'}
            </button>

            {error && <p className="text-red-500 mt-4">{error}</p>}

            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Export History</h3>
                {loading ? (
                    <p>Loading export history...</p>
                ) : exports.length > 0 ? (
                    <ul className="space-y-4">
                        {exports.map(exp => (
                            <li key={exp.id} className="p-4 border rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-medium">Requested on {new Date(exp.createdAt?.toDate()).toLocaleString()}</p>
                                    <p className="text-sm text-gray-500 capitalize">Status: {exp.status}</p>
                                </div>
                                {
                                    exp.status === 'complete' && exp.downloadUrl ? (
                                        <a href={exp.downloadUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Download</a>
                                    ) : (
                                        <span className="text-gray-500"></span>
                                    )
                                }
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No export history found.</p>
                )}
            </div>
        </div>
    );
}
