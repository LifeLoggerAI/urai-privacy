"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { app } from "../../../firebase/firebase";
import Link from "next/link";

export default function ManageConsent() {
  const [consentTiers, setConsentTiers] = useState([]);

  useEffect(() => {
    const fetchConsentTiers = async () => {
      const db = getFirestore(app);
      const consentTiersCol = collection(db, "consentTiers");
      const consentTiersSnapshot = await getDocs(consentTiersCol);
      const consentTiersList = consentTiersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setConsentTiers(consentTiersList);
    };

    fetchConsentTiers();
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">Manage Consent Tiers</h1>
      <Link href="/admin/consent/new" className="bg-blue-500 text-white p-2 rounded mb-4 inline-block">
        New Consent Tier
      </Link>
      <ul>
        {consentTiers.map((tier) => (
          <li key={tier.id}>
            <Link href={`/admin/consent/${tier.id}`}>{tier.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
