
"use client";

import React from 'react';
import { useAuth } from "@/firebase/AuthContext";
import SiteLayout from '@/components/SiteLayout';
import { useRouter } from "next/navigation";
import ConsentManager from "@/components/ConsentManager";
import ExportManager from "@/components/ExportManager";
import DeletionManager from "@/components/DeletionManager";
import AuditLogViewer from '@/components/AuditLogViewer';
import DataUsageLedger from '@/components/DataUsageLedger';

export default function PrivacyPortal() {
    const { user, loading } = useAuth();
    const router = useRouter();

    if (loading) {
        return <SiteLayout><h1>Loading...</h1></SiteLayout>;
    }

    if (!user) {
        router.push('/login');
        return null; 
    }

    return (
        <SiteLayout>
            <div className="container mx-auto px-4 py-8">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">Privacy Portal</h1>
                    <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Welcome, {user.email}. Manage your privacy settings and data below.</p>
                </header>
                
                <div className="grid gap-12 md:grid-cols-1">
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Consent Management</h2>
                        <ConsentManager />
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">Data Export</h2>
                        <ExportManager />
                    </section>

                     <section>
                        <h2 className="text-2xl font-bold mb-4">Data Usage Ledger</h2>
                        <DataUsageLedger />
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">Audit Log</h2>
                        <AuditLogViewer />
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">Account Deletion</h2>
                        <DeletionManager />
                    </section>
                </div>
            </div>
        </SiteLayout>
    );
}
