
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { useAuth } from "@/firebase/AuthContext";

const logActionLabels: { [key: string]: string } = {
    consent_change: 'Consent Settings Updated',
    policy_acknowledgement: 'Policy Acknowledged',
    data_export_requested: 'Data Export Requested',
    account_deletion_requested: 'Account Deletion Requested',
};

const formatLogDetails = (action: string, details: any) => {
    switch (action) {
        case 'consent_change':
            return `Category: ${details.category}, Enabled: ${details.enabled}`;
        case 'policy_acknowledgement':
            return `Version: ${details.policyVersion}`;
        default:
            return JSON.stringify(details, null, 2);
    }
};

const AuditLogViewer = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const fetchLogs = async (loadMore = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            let q = query(
                collection(db, 'audit_logs'), 
                where('userId', '==', user.uid),
                orderBy('timestamp', 'desc'),
                limit(10)
            );

            if (loadMore && lastDoc) {
                q = query(q, startAfter(lastDoc));
            }

            const querySnapshot = await getDocs(q);
            const fetchedLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (querySnapshot.docs.length < 10) {
                setHasMore(false);
            }

            setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
            setLogs(prevLogs => loadMore ? [...prevLogs, ...fetchedLogs] : fetchedLogs);
        } catch (e) {
            console.error(e);
            setError('Failed to fetch audit logs.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [user]);

    if (loading) return <p>Loading audit logs...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="not-prose space-y-4">
            {logs.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map(log => (
                            <li key={log.id} className="p-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{logActionLabels[log.action] || log.action}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(log.timestamp?.seconds * 1000).toLocaleString()}</p>
                                </div>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                    <pre className="whitespace-pre-wrap font-sans bg-gray-50 dark:bg-gray-800 p-2 rounded">{formatLogDetails(log.action, log.details)}</pre>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p>No audit logs found.</p>
            )}
            {hasMore && (
                <button 
                    onClick={() => fetchLogs(true)}
                    disabled={loadingMore}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                    {loadingMore ? 'Loading...' : 'Load More'}
                </button>
            )}
        </div>
    );
};

export default AuditLogViewer;
