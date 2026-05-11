
"use client";

import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../firebase/firebase'; // Assuming you have an initialized firebaseApp export

const functions = getFunctions(firebaseApp);
const getLineage = httpsCallable(functions, 'getLineage');

const DataUsageLedger = () => {
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLedgerData = async () => {
            try {
                const result = await getLineage();
                setLedgerEntries(result.data);
            } catch (error) {
                console.error("Error fetching data lineage:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLedgerData();
    }, []);

    return (
        <div className="not-prose">
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 mb-6 rounded-r-lg">
                <p className="font-bold">Data Provenance</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">This ledger provides a real-time, auditable trail of how your data is used across our systems, from its source to its ultimate purpose.</p>
            </div>

            {loading ? (
                <div className="text-center p-8">
                    <p>Loading data usage ledger...</p>
                </div>
            ) : ledgerEntries.length === 0 ? (
                <div className="text-center p-8">
                    <p>No data usage records found.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Signal</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose of Use</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consent Basis</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retention</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {ledgerEntries.map((entry, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{entry.source}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{entry.payload.transformation}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{entry.consentCategory}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(entry.retentionUntil._seconds * 1000).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(entry.createdAt._seconds * 1000).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DataUsageLedger;
