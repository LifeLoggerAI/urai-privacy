"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

interface Risk {
  description: string;
  score: number;
  status: string;
  category: string;
}

export default function ComplianceDashboard() {
  const [riskData, setRiskData] = useState<Risk[]>([]);
  const [securityReports, setSecurityReports] = useState(0);

  useEffect(() => {
    async function load() {
      const risks = await getDocs(collection(db, "riskRegister"));
      const riskArray = risks.docs.map(d => d.data() as Risk);
      setRiskData(riskArray);

      const sec = await getDocs(collection(db, "securityReports"));
      setSecurityReports(sec.size);
    }
    load();
  }, []);

  const high = riskData.filter(r => r.score >= 15).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1>Compliance Dashboard</h1>

      <h2>Security Reports</h2>
      <p>Total: {securityReports}</p>

      <h2>Risk Heatmap</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={riskData}>
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="score" fill="#111" />
        </BarChart>
      </ResponsiveContainer>

      <p>High Risk Items (≥15): {high}</p>
    </div>
  );
}
