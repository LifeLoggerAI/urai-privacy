
'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TransparencyReportPage() {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transparency_reports'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportData: any[] = [];
      querySnapshot.forEach((doc) => {
        reportData.push({ id: doc.id, ...doc.data() });
      });
      setReports(reportData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Transparency Report</h1>
      <div className="prose lg:prose-xl">
        <p>URAI is committed to transparency. This report provides information about government and law enforcement requests for user data.</p>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Government Requests</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b">Period</th>
                <th className="py-2 px-4 border-b">Country</th>
                <th className="py-2 px-4 border-b">Request Type</th>
                <th className="py-2 px-4 border-b">Requests Received</th>
                <th className="py-2 px-4 border-b">Users Affected</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="py-2 px-4 border-b">{report.period}</td>
                  <td className="py-2 px-4 border-b">{report.country}</td>
                  <td className="py-2 px-4 border-b">{report.reportType}</td>
                  <td className="py-2 px-4 border-b">{report.requestsReceived}</td>
                  <td className="py-2 px-4 border-b">{report.usersAffected}</td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-4 text-center">No reports available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
