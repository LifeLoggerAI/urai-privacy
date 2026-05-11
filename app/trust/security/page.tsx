
export default function SecurityPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Security at URAI</h1>
      <div className="prose lg:prose-xl">
        <p>We take the security of your data very seriously. Here are some of the measures we take to protect your information:</p>

        <h2 className="text-2xl font-bold mt-8">1. Encryption</h2>
        <p>All data is encrypted at rest and in transit using industry-standard encryption protocols.</p>

        <h2 className="text-2xl font-bold mt-8">2. Access Control</h2>
        <p>We have strict access control policies in place to ensure that only authorized personnel have access to user data.</p>

        <h2 className="text-2xl font-bold mt-8">3. Regular Audits</h2>
        <p>We conduct regular security audits to identify and address potential vulnerabilities.</p>

        {/* Add more sections as needed */}
      </div>
    </div>
  );
}
