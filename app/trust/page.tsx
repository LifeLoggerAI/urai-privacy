
import Link from 'next/link';

export default function TrustCenterPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">URAI Trust Center</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <Link href="/trust/privacy-policy" className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold mb-2">Privacy Policy</h2>
          <p className="text-gray-600">Read our full privacy policy to understand how we handle your data.</p>
        </Link>
        
        <Link href="/trust/security" className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold mb-2">Security</h2>
          <p className="text-gray-600">Learn about the security measures we have in place to protect your information.</p>
        </Link>
        
        <Link href="/trust/transparency-report" className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold mb-2">Transparency Report</h2>
          <p className="text-gray-600">View our transparency reports to see how we respond to data requests.</p>
        </Link>
      </div>
    </div>
  );
}
